"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/shared/lib/utils";

export const BackgroundBeamsWithCollision = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const beams = [
    {
      delay: 2,
      duration: 7,
      initialX: 10,
      repeatDelay: 3,
      translateX: 10,
    },
    {
      delay: 4,
      duration: 3,
      initialX: 600,
      repeatDelay: 3,
      translateX: 600,
    },
    {
      className: "h-6",
      duration: 7,
      initialX: 100,
      repeatDelay: 7,
      translateX: 100,
    },
    {
      delay: 4,
      duration: 5,
      initialX: 400,
      repeatDelay: 14,
      translateX: 400,
    },
    {
      className: "h-20",
      duration: 11,
      initialX: 800,
      repeatDelay: 2,
      translateX: 800,
    },
    {
      className: "h-12",
      duration: 4,
      initialX: 1000,
      repeatDelay: 2,
      translateX: 1000,
    },
    {
      className: "h-6",
      delay: 2,
      duration: 6,
      initialX: 1200,
      repeatDelay: 4,
      translateX: 1200,
    },
  ];

  return (
    <div
      ref={parentRef}
      className={cn(
        "relative flex h-96 w-full items-center justify-center overflow-hidden md:h-160",
        className
      )}
    >
      {beams.map((beam) => (
        <CollisionMechanism
          key={beam.initialX + "beam-idx"}
          beamOptions={beam}
          containerRef={containerRef}
          parentRef={parentRef}
        />
      ))}

      {children}
      <div
        ref={containerRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full bg-neutral-100"
        style={{
          boxShadow:
            "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset",
        }}
      ></div>
    </div>
  );
};

const CollisionMechanism = React.forwardRef<
  HTMLDivElement,
  {
    beamOptions?: {
      className?: string;
      delay?: number;
      duration?: number;
      initialX?: number;
      initialY?: number;
      repeatDelay?: number;
      rotate?: number;
      translateX?: number;
      translateY?: number;
    };
    containerRef: React.RefObject<HTMLDivElement | null>;
    parentRef: React.RefObject<HTMLDivElement | null>;
  }
>(({ beamOptions = {}, containerRef, parentRef }, __) => {
  const beamRef = useRef<HTMLDivElement>(null);
  const [collision, setCollision] = useState<{
    coordinates: { x: number; y: number } | null;
    detected: boolean;
  }>({
    coordinates: null,
    detected: false,
  });
  const [beamKey, setBeamKey] = useState(0);
  const [cycleCollisionDetected, setCycleCollisionDetected] = useState(false);

  useEffect(() => {
    const checkCollision = () => {
      if (beamRef.current && containerRef.current && parentRef.current && !cycleCollisionDetected) {
        const beamRect = beamRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = parentRef.current.getBoundingClientRect();

        if (beamRect.bottom >= containerRect.top) {
          const relativeX = beamRect.left - parentRect.left + beamRect.width / 2;
          const relativeY = beamRect.bottom - parentRect.top;

          setCollision({
            coordinates: {
              x: relativeX,
              y: relativeY,
            },
            detected: true,
          });
          setCycleCollisionDetected(true);
        }
      }
    };

    const animationInterval = setInterval(checkCollision, 50);

    return () => clearInterval(animationInterval);
  }, [cycleCollisionDetected, containerRef, parentRef]);

  useEffect(() => {
    if (collision.detected && collision.coordinates) {
      setTimeout(() => {
        setCollision({ coordinates: null, detected: false });
        setCycleCollisionDetected(false);
      }, 2000);

      setTimeout(() => {
        setBeamKey((prevKey) => prevKey + 1);
      }, 2000);
    }
  }, [collision]);

  return (
    <>
      <motion.div
        key={beamKey}
        ref={beamRef}
        animate="animate"
        initial={{
          rotate: beamOptions.rotate || 0,
          translateX: beamOptions.initialX || "0px",
          translateY: beamOptions.initialY || "-200px",
        }}
        transition={{
          delay: beamOptions.delay || 0,
          duration: beamOptions.duration || 8,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: beamOptions.repeatDelay || 0,
          repeatType: "loop",
        }}
        variants={{
          animate: {
            rotate: beamOptions.rotate || 0,
            translateX: beamOptions.translateX || "0px",
            translateY: beamOptions.translateY || "1800px",
          },
        }}
        className={cn(
          "via-primary absolute top-20 left-0 m-auto h-14 w-px rounded-full bg-linear-to-t from-white to-transparent",
          beamOptions.className
        )}
      />
      <AnimatePresence>
        {collision.detected && collision.coordinates && (
          <Explosion
            key={`${collision.coordinates.x}-${collision.coordinates.y}`}
            className=""
            style={{
              left: `${collision.coordinates.x}px`,
              top: `${collision.coordinates.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
});

CollisionMechanism.displayName = "CollisionMechanism";

const Explosion = ({ ...props }: React.HTMLProps<HTMLDivElement>) => {
  const spans = Array.from({ length: 20 }, (_, index) => ({
    // eslint-disable-next-line react-hooks/purity
    directionX: Math.floor(Math.random() * 80 - 40),
    // eslint-disable-next-line react-hooks/purity
    directionY: Math.floor(Math.random() * -50 - 10),
    id: index,
    initialX: 0,
    initialY: 0,
  }));

  return (
    <div {...props} className={cn("absolute z-50 h-2 w-2", props.className)}>
      <motion.div
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="via-primary absolute -inset-x-10 top-0 m-auto h-2 w-10 rounded-full bg-linear-to-r from-transparent to-transparent blur-sm"
      ></motion.div>
      {spans.map((span) => (
        <motion.span
          key={span.id}
          animate={{
            opacity: 0,
            x: span.directionX,
            y: span.directionY,
          }}
          initial={{ opacity: 1, x: span.initialX, y: span.initialY }}
          // eslint-disable-next-line react-hooks/purity
          transition={{ duration: Math.random() * 1.5 + 0.5, ease: "easeOut" }}
          className="to-primary absolute h-1 w-1 rounded-full bg-linear-to-b from-white"
        />
      ))}
    </div>
  );
};
