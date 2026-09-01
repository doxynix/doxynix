import { useEffect, useState } from "react";
import { hcWithType } from "@doxynix/siem-server/client";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "";
const client = hcWithType(SERVER_URL);

type LogEntry = {
  timestamp: string;
  message: string;
};

function Index() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { mutate: sendRequest, isPending } = useMutation({
    mutationFn: async () => {
      try {
        const res = await client.api.logs.scan.$post({
          json: {
            content:
              "Hi! This is a test log.\nHere's a vulnerability: 1234-5678-9012-3456\nAnd here's another safe string.",
          },
        });
        return await res.json();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Error fetching data: ${errorMsg}`, { cause: error });
      }
    },
  });

  useEffect(() => {
    const ctrl = new AbortController();

    async function connectSSE() {
      try {
        await fetchEventSource("/api/logs-stream", {
          credentials: "include",
          method: "GET",

          onerror(err) {
            console.error("SSE Error:", err);
          },

          onmessage(msg) {
            if (msg.event === "log") {
              try {
                const logData: LogEntry = JSON.parse(msg.data);
                setLogs((prev) => [logData, ...prev]);
              } catch (error) {
                console.error("Log parsing error:", error);
              }
            }
          },

          async onopen(response) {
            if (response.status === 401) {
              ctrl.abort();
              return;
            }
            if (!response.ok) {
              throw new Error(`SSE error status: ${response.status}`);
            }
          },
          signal: ctrl.signal,
        });
      } catch (error) {
        if (!ctrl.signal.aborted) {
          console.error("SSE Connection Failed", error);
        }
      }
    }

    void connectSSE();

    return () => {
      ctrl.abort();
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-6">
      {isPending && (
        <div className="size-7 animate-spin rounded-full border border-b-0 bg-transparent" />
      )}
      <h2 className="font-bold text-2xl">SIEM Live Stream</h2>

      <div className="flex items-center gap-4">
        <button
          className="rounded-md bg-black px-3 py-2 text-white"
          onClick={() => sendRequest()}
          type="button"
        >
          Call API (Scan Test)
        </button>
      </div>

      <div className="flex h-80 w-full flex-col gap-2 overflow-y-auto rounded-md border border-gray-800 bg-black p-4 font-mono text-green-400 text-xs">
        {logs.length === 0 ? (
          <p className="text-gray-500">Waiting logs from Axiom...</p>
        ) : (
          logs.map((log) => (
            <div className="border-gray-900 border-b pb-1" key={`${log.timestamp}-${log.message}`}>
              <span className="text-gray-500">
                [{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "N/A"}]
              </span>{" "}
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Index;
