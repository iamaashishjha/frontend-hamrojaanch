import { get } from "@/lib/apiClient";

type SignalingRole = "publisher" | "viewer";
type LiveStatus = "idle" | "connecting" | "connected" | "offline" | "error";

type SignalingMessage =
  | { type: "join"; role: SignalingRole; room: string; token: string }
  | { type: "offer"; targetId: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; targetId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; targetId: string; candidate: RTCIceCandidateInit }
  | { type: "ping" }
  | { type: "proctor-command"; action: "warn" | "terminate"; reason?: string };

type ServerMessage =
  | { type: "joined"; clientId: string; role: SignalingRole; room: string }
  | { type: "viewer-joined"; viewerId: string }
  | { type: "viewer-left"; viewerId: string }
  | { type: "publisher-ready" }
  | { type: "publisher-offline" }
  | { type: "offer"; senderId: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; senderId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; senderId: string; candidate: RTCIceCandidateInit }
  | { type: "error"; message: string }
  | { type: "proctor-warn"; reason?: string }
  | { type: "proctor-terminate"; reason?: string };

type TokenResponse = { token: string; expiresAt: string };

const DEFAULT_SIGNALING_WS = "ws://localhost:3001/ws";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const safeParse = (value: string): ServerMessage | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    return parsed as ServerMessage;
  } catch {
    return null;
  }
};

const getSignalUrls = () => {
  const wsUrl = (import.meta.env.VITE_SIGNALING_URL as string | undefined) ?? DEFAULT_SIGNALING_WS;
  const httpBase =
    (import.meta.env.VITE_SIGNALING_HTTP_URL as string | undefined) ??
    wsUrl.replace(/^ws/, "http").replace(/\/ws$/, "");
  return { wsUrl, httpBase };
};

const getIceServers = () => {
  const fallback = [{ urls: "stun:stun.l.google.com:19302" }];
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const createPeer = () => new RTCPeerConnection({ iceServers: getIceServers() });

async function fetchToken(params: {
  role: string;
  examId: string;
  attemptId: string;
}): Promise<TokenResponse> {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
  if (!apiBase) {
    throw new Error("VITE_API_BASE_URL is required for signaling token issuance.");
  }
  const data = await get<TokenResponse>("/v1/signaling/token", {
    role: params.role,
    examId: params.examId,
    attemptId: params.attemptId,
  });
  if (!data?.token) {
    throw new Error("Live proctor token missing.");
  }
  return data;
}

function connectSignaling(options: {
  role: SignalingRole;
  room: string;
  token: string;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: LiveStatus) => void;
}) {
  const { wsUrl } = getSignalUrls();
  const ws = new WebSocket(wsUrl);
  const send = (message: SignalingMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  ws.onopen = () => {
    send({ type: "join", role: options.role, room: options.room, token: options.token });
    options.onStatus("connecting");
  };

  ws.onmessage = (event) => {
    const message = safeParse(event.data);
    if (message) {
      options.onMessage(message);
    }
  };

  ws.onclose = () => options.onStatus("offline");
  ws.onerror = () => options.onStatus("error");

  return {
    send,
    close: () => ws.close(),
  };
}

export async function createPublisher(params: {
  examId: string;
  attemptId: string;
  stream: MediaStream;
  role: "candidate";
  onStatus?: (status: LiveStatus) => void;
  onProctorCommand?: (command: "warn" | "terminate", reason?: string) => void;
}) {
  const room = `${params.examId}:${params.attemptId}`;
  const status = params.onStatus ?? (() => {});
  const { token } = await fetchToken({
    role: params.role,
    examId: params.examId,
    attemptId: params.attemptId,
  });

  const peers = new Map<string, RTCPeerConnection>();
  const signaling = connectSignaling({
    role: "publisher",
    room,
    token,
    onStatus: status,
    onMessage: async (message) => {
      if (message.type === "joined") {
        status("connected");
        return;
      }
      if (message.type === "viewer-joined") {
        const pc = createPeer();
        peers.set(message.viewerId, pc);
        params.stream.getTracks().forEach((track) => pc.addTrack(track, params.stream));
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.send({
              type: "ice-candidate",
              targetId: message.viewerId,
              candidate: event.candidate.toJSON(),
            });
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaling.send({ type: "offer", targetId: message.viewerId, sdp: offer });
        return;
      }
      if (message.type === "answer") {
        const pc = peers.get(message.senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        }
        return;
      }
      if (message.type === "ice-candidate") {
        const pc = peers.get(message.senderId);
        if (pc && message.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } catch {
            // Ignore ICE failures in mock connectivity.
          }
        }
        return;
      }
      if (message.type === "viewer-left") {
        const pc = peers.get(message.viewerId);
        if (pc) {
          pc.close();
          peers.delete(message.viewerId);
        }
        return;
      }
      if (message.type === "proctor-warn") {
        params.onProctorCommand?.("warn", message.reason);
        return;
      }
      if (message.type === "proctor-terminate") {
        params.onProctorCommand?.("terminate", message.reason);
        return;
      }
      if (message.type === "error") {
        status("error");
      }
    },
  });

  return {
    close: () => {
      peers.forEach((pc) => pc.close());
      peers.clear();
      signaling.close();
    },
  };
}

export async function createViewer(params: {
  examId: string;
  attemptId: string;
  role: "admin" | "teacher" | "proctor";
  onStream: (stream: MediaStream) => void;
  onStatus?: (status: LiveStatus) => void;
}) {
  const room = `${params.examId}:${params.attemptId}`;
  const status = params.onStatus ?? (() => {});
  const { token } = await fetchToken({
    role: params.role,
    examId: params.examId,
    attemptId: params.attemptId,
  });

  let pc: RTCPeerConnection | null = null;

  const closePeer = () => {
    if (pc) {
      pc.close();
      pc = null;
    }
  };

  const signaling = connectSignaling({
    role: "viewer",
    room,
    token,
    onStatus: status,
    onMessage: async (message) => {
      if (message.type === "joined") {
        status("connected");
        return;
      }
      if (message.type === "publisher-ready") {
        status("connected");
        return;
      }
      if (message.type === "publisher-offline") {
        closePeer();
        status("offline");
        return;
      }
      if (message.type === "offer") {
        closePeer();
        pc = createPeer();
        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (stream) {
            params.onStream(stream);
          }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            signaling.send({
              type: "ice-candidate",
              targetId: message.senderId,
              candidate: event.candidate.toJSON(),
            });
          }
        };
        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signaling.send({ type: "answer", targetId: message.senderId, sdp: answer });
        return;
      }
      if (message.type === "ice-candidate" && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch {
          // Ignore ICE failures in mock connectivity.
        }
        return;
      }
      if (message.type === "error") {
        status("error");
      }
    },
  });

  return {
    close: () => {
      closePeer();
      signaling.close();
    },
    sendProctorCommand: (action: "warn" | "terminate", reason?: string) => {
      signaling.send({ type: "proctor-command", action, reason });
    },
  };
}

export type { LiveStatus };
