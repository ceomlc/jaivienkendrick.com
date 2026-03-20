/**
 * ResumeViewer — Command Center: Screen 2
 *
 * The actual resume PDF is rendered as a 3D floating document in the
 * background. As the user scrolls, the camera orbits around the document
 * and a glowing highlight box illuminates the corresponding section.
 * Foreground text content overlays the experience.
 *
 * 3D Resume: 60% opacity, orbiting camera, section highlight overlays
 */

import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════
   CONSTANTS & DATA
   ═══════════════════════════════════════════════════════ */

const RESUME_IMAGE_URL = "https://d2xsxph8kpxj0f.cloudfront.net/107630172/8yTcvRQivSUeBoZH7nKhfL/resume-page-0_ab0a4ccf.png";

// Resume aspect ratio: 2479 x 3504 → width:height = 0.7076
const RESUME_WIDTH = 4;
const RESUME_HEIGHT = RESUME_WIDTH / 0.7076; // ~5.65

// Section regions on the resume (normalized Y: 0=top, 1=bottom)
const SECTION_REGIONS = [
  { yStart: 0.100, yEnd: 0.225 },   // 0: Professional Summary
  { yStart: 0.220, yEnd: 0.400 },   // 1: Morgan Stanley
  { yStart: 0.398, yEnd: 0.558 },   // 2: More Life Consulting
  { yStart: 0.558, yEnd: 0.668 },   // 3: AT&T
  { yStart: 0.672, yEnd: 0.726 },   // 4: Kendrick Legacy Scholarship
  { yStart: 0.812, yEnd: 0.896 },   // 5: Skills
  { yStart: 0.738, yEnd: 0.800 },   // 6: Education
  { yStart: 0.910, yEnd: 0.958 },   // 7: Links / Contact
];

interface ResumeSection {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle?: string;
  period?: string;
  content: string[];
  tags?: string[];
  accentColor: string;
}

const sections: ResumeSection[] = [
  {
    id: "summary",
    number: "01",
    label: "MISSION BRIEF",
    title: "OPERATOR. BUILDER. AUTOMATOR.",
    content: [
      "AI Strategy & Business Operations Consultant with 3 years of experience designing AI automation and operational systems that cut manual work by 40+ hours weekly and accelerate product development by 70%+.",
      "Skilled in automation architecture, API integrations, Alteryx, UiPath, and process analysis; delivers workflow redesigns that generate $5K+ monthly savings and scale across HVAC, travel, startup, and regulated environments.",
    ],
    accentColor: "#00ff88",
  },
  {
    id: "morgan-stanley",
    number: "02",
    label: "PRIMARY OPS",
    title: "Operations Analyst",
    subtitle: "Morgan Stanley — Operations Risk & Regulatory Control",
    period: "Jul 2025 — Present",
    content: [
      "Strengthened operational integrity by improving risk event reviews and reducing exposure with targeted controls.",
      "Supported regulatory workflows by validating data quality to align processes with SEC and FINRA requirements.",
      "Automated routine tasks using Alteryx and UiPath to accelerate operational workflows and reporting.",
      "Developing an AI-powered training assistant enabling new hires to conversationally query procedures, reducing onboarding friction and accelerating time-to-competency.",
    ],
    accentColor: "#00ff88",
  },
  {
    id: "more-life",
    number: "03",
    label: "CONSULTING OPS",
    title: "Founder & AI Consultant",
    subtitle: "More Life Consulting",
    period: "2023 — Present",
    content: [
      "Design AI automation systems that eliminate 40+ hours of manual work per week for clients across HVAC, travel, and startup sectors.",
      "Reduce product development timelines from 10–12 months to under 3 months, accelerating speed-to-market by 70%+.",
      "Deliver workflow redesigns that generate $5,000+ in monthly operational savings for small and mid-sized businesses.",
      "Build LLM-powered agents, integrations, and internal tools using Replit, Cursor, Lovable, Make.com, n8n, and multi-API architectures.",
      "Consulted notable companies including The James Brand and Virgent AI on digital systems and operational strategy.",
    ],
    accentColor: "#4a9eff",
  },
  {
    id: "att",
    number: "04",
    label: "LEADERSHIP OPS",
    title: "AT&T Rising Future Maker",
    subtitle: "AT&T — National Leadership Program",
    period: "2022 — 2023",
    content: [
      "Led design collaboration with NBA partners to create All-Star Weekend merchandise driving measurable brand visibility.",
      "Organized community Hoop Fest events that increased local participation and improved community relations.",
      "Represented AT&T at national conferences to strengthen corporate presence and expand stakeholder networks.",
      "Developed engagement strategies that produced measurable improvements in brand recognition and community impact.",
    ],
    accentColor: "#ffaa00",
  },
  {
    id: "scholarship",
    number: "05",
    label: "COMMUNITY OPS",
    title: "Kendrick Legacy Scholarship",
    subtitle: "Founder",
    period: "2023 — Present",
    content: [
      "Built a community-funded scholarship awarding support to 20+ high school students, increasing local sponsorships by 30%.",
    ],
    accentColor: "#00ff88",
  },
  {
    id: "skills",
    number: "06",
    label: "ARMAMENT",
    title: "Tech Stack & Capabilities",
    content: [],
    tags: [
      "AI Strategy", "Automation Architecture", "LLM Ops", "Custom Agents", "Make.com", "n8n",
      "Alteryx", "UiPath", "Power BI", "Data & Process Analysis", "Operational Risk", "Regulatory Compliance",
      "Workflow Optimization", "Project Management", "Problem Structuring", "Cross-Functional Collaboration",
      "Replit", "API Integrations", "Python", "React", "Git", "Cursor",
    ],
    accentColor: "#4a9eff",
  },
  {
    id: "education",
    number: "07",
    label: "INTELLIGENCE",
    title: "University of Maryland",
    subtitle: "College Park, MD",
    content: [
      "B.S., Business Administration (Marketing)",
      "Robert H. Smith School of Business — Class of 2025",
    ],
    accentColor: "#ffaa00",
  },
  {
    id: "contact",
    number: "08",
    label: "COMMS",
    title: "Let's Build Something.",
    content: [
      "Ready to deploy AI-powered systems, streamline operations, or architect something new? Open a secure channel.",
    ],
    accentColor: "#00ff88",
  },
];

/* ═══════════════════════════════════════════════════════
   WEBGL HELPERS
   ═══════════════════════════════════════════════════════ */

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch { return false; }
}

class ThreeErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.warn("ResumeScene fallback:", error.message); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ═══════════════════════════════════════════════════════
   3D SCENE
   ═══════════════════════════════════════════════════════ */

function Particles({ count = 30 }: { count?: number; scrollProgress: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() =>
    Array.from({ length: count }, () => ({
      pos: [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8] as [number, number, number],
      speed: 0.08 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
      scale: 0.01 + Math.random() * 0.025,
    })), [count]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      dummy.position.set(
        p.pos[0] + Math.sin(t * p.speed + p.offset) * 0.4,
        p.pos[1] + Math.cos(t * p.speed * 0.7 + p.offset) * 0.5,
        p.pos[2] + Math.sin(t * p.speed * 0.3) * 0.2
      );
      dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 2 + p.offset) * 0.3));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} transparent opacity={0.3} />
    </instancedMesh>
  );
}

function SectionHighlight({ activeIndex, accentColor }: { activeIndex: number; accentColor: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const targetY = useRef(0);
  const targetScaleY = useRef(0);
  const currentY = useRef(0);
  const currentScaleY = useRef(0);
  const currentOpacity = useRef(0);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;
    const region = SECTION_REGIONS[activeIndex];
    if (!region) return;
    const halfH = RESUME_HEIGHT / 2;
    const yTop = halfH - region.yStart * RESUME_HEIGHT;
    const yBottom = halfH - region.yEnd * RESUME_HEIGHT;
    const highlightHeight = yTop - yBottom;
    const highlightCenterY = (yTop + yBottom) / 2;
    targetY.current = highlightCenterY;
    targetScaleY.current = highlightHeight;
    currentY.current += (targetY.current - currentY.current) * 0.06;
    currentScaleY.current += (targetScaleY.current - currentScaleY.current) * 0.06;
    currentOpacity.current += (0.25 - currentOpacity.current) * 0.05;
    meshRef.current.position.y = currentY.current;
    meshRef.current.scale.y = currentScaleY.current;
    meshRef.current.scale.x = RESUME_WIDTH * 0.95;
    materialRef.current.color.set(accentColor);
    materialRef.current.opacity = currentOpacity.current;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0.02]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        color={accentColor}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SectionHighlightBorder({ activeIndex, accentColor }: { activeIndex: number; accentColor: string }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const currentY = useRef(0);
  const currentHeight = useRef(0);

  useFrame(() => {
    if (!lineRef.current) return;
    const region = SECTION_REGIONS[activeIndex];
    if (!region) return;
    const halfH = RESUME_HEIGHT / 2;
    const yTop = halfH - region.yStart * RESUME_HEIGHT;
    const yBottom = halfH - region.yEnd * RESUME_HEIGHT;
    const highlightCenterY = (yTop + yBottom) / 2;
    const highlightHeight = yTop - yBottom;
    currentY.current += (highlightCenterY - currentY.current) * 0.06;
    currentHeight.current += (highlightHeight - currentHeight.current) * 0.06;
    lineRef.current.position.y = currentY.current;
    lineRef.current.scale.y = currentHeight.current;
    lineRef.current.scale.x = RESUME_WIDTH * 0.95;
    (lineRef.current.material as THREE.LineBasicMaterial).color.set(accentColor);
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.5, 0.5, 0,   0.5, 0.5, 0,
       0.5, 0.5, 0,   0.5, -0.5, 0,
       0.5, -0.5, 0, -0.5, -0.5, 0,
      -0.5, -0.5, 0, -0.5, 0.5, 0,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    return geo;
  }, []);

  return (
    <lineSegments ref={lineRef} geometry={geometry} position={[0, 0, 0.03]}>
      <lineBasicMaterial color={accentColor} transparent opacity={0.7} linewidth={1} />
    </lineSegments>
  );
}

function ResumeDocument({ activeIndex, accentColor }: {
  scrollProgress: number;
  activeIndex: number;
  accentColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, RESUME_IMAGE_URL);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  }, [texture]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 0.3) * 0.08;
    groupRef.current.position.x = Math.cos(t * 0.2) * 0.05;
    const breathe = 1 + Math.sin(t * 0.4) * 0.005;
    groupRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[RESUME_WIDTH, RESUME_HEIGHT]} />
        <meshStandardMaterial
          map={texture}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[RESUME_WIDTH, RESUME_HEIGHT]} />
        <meshStandardMaterial color="#0a1a0a" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[RESUME_WIDTH + 0.06, RESUME_HEIGHT + 0.06]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <SectionHighlight activeIndex={activeIndex} accentColor={accentColor} />
      <SectionHighlightBorder activeIndex={activeIndex} accentColor={accentColor} />
    </group>
  );
}

function OrbitingCamera({ scrollProgress, activeIndex }: { scrollProgress: number; activeIndex: number }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 8));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const orbitAngle = scrollProgress * Math.PI * 1.5 - Math.PI * 0.25;
    const radius = 7 + Math.sin(scrollProgress * Math.PI * 2) * 1;
    const camX = Math.sin(orbitAngle) * radius * 0.6;
    const camY = Math.cos(scrollProgress * Math.PI) * 1.5;
    const camZ = Math.cos(orbitAngle) * radius * 0.8 + 2;
    targetPos.current.set(camX, camY, Math.max(camZ, 4));
    const region = SECTION_REGIONS[activeIndex];
    if (region) {
      const halfH = RESUME_HEIGHT / 2;
      const regionCenterY = halfH - ((region.yStart + region.yEnd) / 2) * RESUME_HEIGHT;
      targetLookAt.current.set(0, regionCenterY * 0.3, 0);
    }
    camera.position.lerp(targetPos.current, 0.03);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

function SceneLights({ activeIndex }: { activeIndex: number }) {
  const l1 = useRef<THREE.PointLight>(null);
  const l2 = useRef<THREE.PointLight>(null);
  const l3 = useRef<THREE.SpotLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const color = sections[activeIndex]?.accentColor || "#00ff88";
    if (l1.current) {
      l1.current.position.set(Math.sin(t * 0.3) * 4, 3, 5);
      l1.current.intensity = 3;
      l1.current.color.set(color);
    }
    if (l2.current) {
      l2.current.position.set(Math.cos(t * 0.2) * 3, -2, 4);
      l2.current.intensity = 2;
    }
    if (l3.current) {
      l3.current.position.set(0, 0, 8);
      l3.current.intensity = 4;
    }
  });

  return (
    <>
      <pointLight ref={l1} color="#00ff88" intensity={3} distance={20} />
      <pointLight ref={l2} color="#4a9eff" intensity={2} distance={15} />
      <spotLight ref={l3} color="#ffffff" intensity={4} distance={25} angle={0.5} penumbra={0.5} />
      <ambientLight intensity={0.15} color="#ffffff" />
    </>
  );
}

function ResumeScene({ scrollProgress, activeIndex }: { scrollProgress: number; activeIndex: number }) {
  const accentColor = sections[activeIndex]?.accentColor || "#00ff88";
  return (
    <>
      <OrbitingCamera scrollProgress={scrollProgress} activeIndex={activeIndex} />
      <SceneLights activeIndex={activeIndex} />
      <ResumeDocument scrollProgress={scrollProgress} activeIndex={activeIndex} accentColor={accentColor} />
      <Particles scrollProgress={scrollProgress} />
      <fog attach="fog" args={["#0a0a0a", 8, 25]} />
    </>
  );
}

function CSSFallback() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15 }}>
        <img
          src={RESUME_IMAGE_URL}
          alt=""
          style={{ maxHeight: "90vh", width: "auto", filter: "brightness(0.5) contrast(1.2)", transform: "perspective(800px) rotateY(-5deg)" }}
        />
      </div>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", opacity: 0.1,
        background: "radial-gradient(circle, #00ff88 0%, transparent 70%)", top: "10%", right: "5%", filter: "blur(100px)" }} />
      <div style={{ position: "absolute", width: 350, height: 350, borderRadius: "50%", opacity: 0.08,
        background: "radial-gradient(circle, #4a9eff 0%, transparent 70%)", bottom: "20%", left: "10%", filter: "blur(80px)" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION CONTENT
   ═══════════════════════════════════════════════════════ */

function SectionContent({ section, isActive }: { section: ResumeSection; isActive: boolean }) {
  const isSkills = section.id === "skills";
  const isContact = section.id === "contact";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.12 }}
      transition={{ duration: 0.6 }}
      style={{ position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          height: 1,
          width: isActive ? 48 : 32,
          backgroundColor: isActive ? section.accentColor : "rgba(255,255,255,0.15)",
          transition: "all 0.5s"
        }} />
        <span style={{ fontFamily: "monospace", fontSize: "0.6rem", letterSpacing: "0.2em", color: section.accentColor }}>
          {section.number}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "0.5rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
          {section.label}
        </span>
      </div>

      {section.period && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: "inline-block",
            fontFamily: "monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            padding: "4px 12px",
            border: `1px solid ${section.accentColor}33`,
            color: section.accentColor,
            marginBottom: 16,
          }}
        >
          {section.period}
        </motion.span>
      )}

      <h2 style={{
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: "clamp(1.4rem, 3vw, 2.5rem)",
        color: "#fff",
        marginBottom: 8,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      }}>
        {section.title}
      </h2>

      {section.subtitle && (
        <p style={{ fontFamily: "monospace", fontSize: "0.875rem", color: section.accentColor, marginBottom: 20 }}>
          {section.subtitle}
        </p>
      )}

      {section.content.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, maxWidth: 580 }}>
          {section.content.map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: isActive ? 1 : 0.3, x: isActive ? 0 : -5 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: "0.9rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}
            >
              <span style={{
                marginTop: 8,
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                backgroundColor: section.accentColor,
                opacity: 0.6,
              }} />
              {item}
            </motion.li>
          ))}
        </ul>
      )}

      {isSkills && section.tags && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 580 }}>
          {section.tags.map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.9 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                padding: "5px 12px",
                border: "1px solid rgba(0,255,136,0.2)",
                background: "rgba(0,255,136,0.05)",
                color: "rgba(0,255,136,0.8)",
                transition: "all 0.3s ease",
              }}
            >
              {tag}
            </motion.span>
          ))}
        </div>
      )}

      {isContact && isActive && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}
        >
          <a href="mailto:jkendrick0610@gmail.com" style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 20px",
            border: "1px solid rgba(0,255,136,0.4)",
            color: "#00ff88",
            textDecoration: "none",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            letterSpacing: "0.1em",
            transition: "all 0.3s",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
            jkendrick0610@gmail.com
          </a>
          <a href="tel:+16095005660" style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 20px",
            border: "1px solid rgba(74,158,255,0.4)",
            color: "#4a9eff",
            textDecoration: "none",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            letterSpacing: "0.1em",
            transition: "all 0.3s",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4a9eff" }} />
            (609) 500-5660
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   SIDE NAV
   ═══════════════════════════════════════════════════════ */

function SideNav({ activeIndex }: { activeIndex: number }) {
  return (
    <div style={{
      position: "fixed",
      right: 24,
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 30,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 12,
    }}>
      {sections.map((s, i) => (
        <button
          key={s.id}
          onClick={() => {
            const el = document.getElementById(`rv-section-${s.id}`);
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 0",
          }}
        >
          <span style={{
            fontFamily: "monospace",
            fontSize: "0.5rem",
            letterSpacing: "0.15em",
            color: i === activeIndex ? s.accentColor : "rgba(255,255,255,0.2)",
            opacity: i === activeIndex ? 1 : 0,
            transition: "all 0.3s",
          }}>
            {s.number}
          </span>
          <div style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? s.accentColor : "rgba(255,255,255,0.15)",
            width: i === activeIndex ? 32 : 12,
            boxShadow: i === activeIndex ? "0 0 8px rgba(0,255,136,0.4)" : "none",
            transition: "all 0.3s",
          }} />
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TOP BAR
   ═══════════════════════════════════════════════════════ */

function TopBar({ onBack, progress }: { onBack: () => void; progress: number }) {
  return (
    <>
      {/* Scroll progress line */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 2,
        zIndex: 50,
        background: "linear-gradient(90deg, #00ff88, #4a9eff, #ffaa00)",
        width: `${progress * 100}%`,
        transition: "width 0.1s linear",
      }} />

      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, transparent 100%)",
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#00ff88",
            fontFamily: "monospace",
            fontSize: "0.75rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            transition: "all 0.3s",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: "0.55rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
            Resume // Jaivien Kendrick
          </span>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "pulse 2s infinite" }} />
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

interface ResumeViewerProps {
  onBack: () => void;
}

export default function ResumeViewer({ onBack }: ResumeViewerProps) {
  const [webglOk] = useState(() => isWebGLAvailable());
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handle = () => {
      const top = container.scrollTop;
      const total = container.scrollHeight - container.clientHeight;
      const progress = total > 0 ? Math.min(Math.max(top / total, 0), 1) : 0;
      setScrollProgress(progress);

      let bestIndex = 0;
      let bestVisibility = -1;
      sections.forEach((s, i) => {
        const el = container.querySelector(`#rv-section-${s.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const viewH = container.clientHeight;
          const visibleTop = Math.max(rect.top, 0);
          const visibleBottom = Math.min(rect.bottom, viewH);
          const visible = Math.max(0, visibleBottom - visibleTop);
          if (visible > bestVisibility) {
            bestVisibility = visible;
            bestIndex = i;
          }
        }
      });
      setActiveIndex(bestIndex);
    };

    container.addEventListener("scroll", handle, { passive: true });
    handle();
    return () => container.removeEventListener("scroll", handle);
  }, []);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, []);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#0a0a0a",
      overflow: "hidden",
    }}>
      {/* 3D Resume Background — fixed inside viewer */}
      {webglOk ? (
        <ThreeErrorBoundary fallback={<CSSFallback />}>
          <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            <Canvas
              camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
              style={{ background: "transparent" }}
            >
              <ResumeScene scrollProgress={scrollProgress} activeIndex={activeIndex} />
            </Canvas>
          </div>
        </ThreeErrorBoundary>
      ) : (
        <CSSFallback />
      )}

      {/* Grid overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Scan line */}
      <div style={{
        position: "absolute",
        left: 0,
        width: "100%",
        height: 3,
        background: "linear-gradient(90deg, transparent, rgba(0,255,136,0.15), transparent)",
        zIndex: 2,
        pointerEvents: "none",
        animation: "rvScanMove 4s linear infinite",
      }} />

      {/* Top bar */}
      <TopBar onBack={onBack} progress={scrollProgress} />

      {/* Side nav */}
      <SideNav activeIndex={activeIndex} />

      {/* Scrollable content container */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(0,255,136,0.3) rgba(10,10,10,0.5)",
        }}
      >
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={`rv-section-${section.id}`}
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{
              position: "relative",
              zIndex: 10,
              maxWidth: 580,
              margin: "0 0 0 8%",
              padding: "96px 24px",
              width: "100%",
            }}>
              <SectionContent section={section} isActive={i === activeIndex} />
            </div>
          </section>
        ))}

        {/* Footer */}
        <footer style={{
          position: "relative",
          zIndex: 10,
          padding: "32px 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: "0.55rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            JAIVIEN KENDRICK // 2025
          </span>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.6rem",
              color: "rgba(0,255,136,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Back to Home
          </button>
        </footer>
      </div>

      <style>{`
        @keyframes rvScanMove {
          0% { top: -3px; }
          100% { top: 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
