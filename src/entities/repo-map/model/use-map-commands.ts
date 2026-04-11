import { useReactFlow } from "@xyflow/react";

export function useMapCommands() {
  const { fitView, getNodes, zoomIn, zoomOut } = useReactFlow();

  return {
    fitView: () => {
      void fitView({ duration: 400, padding: 0.1 });
    },
    focusSelected: () => {
      const selectedNode = getNodes().find((n) => n.selected ?? false);
      if (selectedNode) {
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
