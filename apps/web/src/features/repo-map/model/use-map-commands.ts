import { useSearchParams } from "next/navigation";
import { useReactFlow } from "@xyflow/react";

export function useMapCommands() {
  const { fitView, getNodes, zoomIn, zoomOut } = useReactFlow();
  const searchParams = useSearchParams();

  return {
    fitView: () => {
      void fitView({ duration: 400, padding: 0.1 });
    },
    focusSelected: () => {
      const nodes = getNodes();
      const selectedIdFromQuery = searchParams.get("node");
      const selectedNode =
        nodes.find((n) => n.selected === true) ??
        (selectedIdFromQuery != null ? nodes.find((n) => n.id === selectedIdFromQuery) : undefined);

      if (selectedNode != null) {
        void fitView({
          duration: 400,
          nodes: [{ id: selectedNode.id }],
          padding: 1,
        });
      } else {
        void fitView({ duration: 400, padding: 0.1 });
      }
    },
    zoomIn: () => {
      void zoomIn({ duration: 400 });
    },
    zoomOut: () => {
      void zoomOut({ duration: 400 });
    },
  };
}
