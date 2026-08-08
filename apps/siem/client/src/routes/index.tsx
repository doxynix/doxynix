import { hcWithType } from "@doxynix/siem-server/client";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";
const client = hcWithType(SERVER_URL);

type LogEntry = {
  timestamp: string;
  message: string;
};

function Index() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const {
    mutate: sendRequest,
    data,
    isPending,
  } = useMutation({
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
        throw new Error(`Error fetching data:${error}`);
      }
    },
  });

  useEffect(() => {
    const ctrl = new AbortController();

    async function connectSSE() {
      try {
        await fetchEventSource("/api/logs-stream", {
          method: "GET",
          credentials: "include",
          signal: ctrl.signal,

          onmessage(msg) {
            if (msg.event === "log") {
              try {
                const logData: LogEntry = JSON.parse(msg.data);
                setLogs((prev) => [logData, ...prev]);
              } catch (e) {
                console.error("Log parsing error:", e);
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

          onerror(err) {
            console.error("SSE Error:", err);
          },
        });
      } catch (err) {
        if (!ctrl.signal.aborted) {
          console.error("SSE Connection Failed", err);
        }
      }
    }

    connectSSE();

    return () => {
      ctrl.abort();
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 items-center justify-center min-h-screen p-6">
      {isPending && (
        <div className="animate-spin size-7 border border-b-0 bg-transparent rounded-full" />
      )}
      <h2 className="text-2xl font-bold">SIEM Live Stream</h2>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => sendRequest()}
          className="bg-black text-white px-3 py-2 rounded-md"
        >
          Call API (Scan Test)
        </button>
      </div>

      <div className="w-full bg-black text-green-400 p-4 rounded-md font-mono text-xs h-80 overflow-y-auto flex flex-col gap-2 border border-gray-800">
        {logs.length === 0 ? (
          <p className="text-gray-500">Waiting logs from Axiom...</p>
        ) : (
          logs.map((log) => (
            <div key={`${log.timestamp}-${log.message}`} className="border-b border-gray-900 pb-1">
              <span className="text-gray-500">
                [{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "N/A"}]
              </span>{" "}
              {log.message}
            </div>
          ))
        )}
      </div>

      {data && (
        <pre className="w-full bg-gray-100 p-4 rounded-md text-xs">
          <code>Message: {data.message}</code>
        </pre>
      )}
    </div>
  );
}

export default Index;
