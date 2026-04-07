/**
 * ResumeViewer — Mission Dossier
 *
 * The actual resume PDF is rendered as a 3D floating document in the
 * background. As the user scrolls, the camera orbits around the document
 * and a glowing highlight box illuminates the corresponding section.
 * Foreground text content overlays the experience.
 *
 * Color palette matches main site: Crimson #C41E3A / #ff2d78, Bone #F5F0E8
 */

import { useState, useEffect, useRef, useMemo, Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════
   CONSTANTS & DATA
   ═══════════════════════════════════════════════════════ */

const RESUME_IMAGE_URL = "/resume-preview.png";

// Resume aspect ratio: 1836 x 2376 → width:height = 0.7727
const RESUME_WIDTH = 4;
const RESUME_HEIGHT = RESUME_WIDTH / 0.7727; // ~5.18

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

// Site palette
const CRIMSON  = "#C41E3A";
const CRIMSON2 = "#ff2d78";
const BONE     = "#F5F0E8";

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
    accentColor: CRIMSON,
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
    accentColor: CRIMSON,
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
    accentColor: CRIMSON2,
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
    accentColor: CRIMSON,
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
    accentColor: CRIMSON2,
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
    accentColor: CRIMSON,
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
    accentColor: CRIMSON2,
  },
  {
    id: "contact",
    number: "08",
    label: "COMMS",
    title: "Let's Build Something.",
    content: [
      "Ready to deploy AI-powered systems, streamline operations, or architect something new? Open a secure channel.",
    ],
    accentColor: CRIMSON,
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
      <meshStandardMaterial color={CRIMSON} emissive={CRIMSON} emissiveIntensity={1.5} transparent opacity={0.25} />
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
    currentOpacity.current += (0.22 - currentOpacity.current) * 0.05;
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
        opacity={0.18}
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
      <lineBasicMaterial color={accentColor} transparent opacity={0.8} linewidth={1} />
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
        <meshStandardMaterial color="#1a0508" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Edge glow — crimson tint */}
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[RESUME_WIDTH + 0.06, RESUME_HEIGHT + 0.06]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.07} side={THREE.DoubleSide} />
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
    const color = sections[activeIndex]?.accentColor || CRIMSON;
    if (l1.current) {
      l1.current.position.set(Math.sin(t * 0.3) * 4, 3, 5);
      l1.current.intensity = 4;
      l1.current.color.set(color);
    }
    if (l2.current) {
      l2.current.position.set(Math.cos(t * 0.2) * 3, -2, 4);
      l2.current.intensity = 2;
      l2.current.color.set(CRIMSON2);
    }
    if (l3.current) {
      l3.current.position.set(0, 0, 8);
      l3.current.intensity = 3;
    }
  });

  return (
    <>
      <pointLight ref={l1} color={CRIMSON} intensity={4} distance={20} />
      <pointLight ref={l2} color={CRIMSON2} intensity={2} distance={15} />
      <spotLight ref={l3} color="#ffffff" intensity={3} distance={25} angle={0.5} penumbra={0.5} />
      <ambientLight intensity={0.12} color="#ffffff" />
    </>
  );
}

function ResumeScene({ scrollProgress, activeIndex }: { scrollProgress: number; activeIndex: number }) {
  const accentColor = sections[activeIndex]?.accentColor || CRIMSON;
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
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", opacity: 0.12,
        background: `radial-gradient(circle, ${CRIMSON} 0%, transparent 70%)`, top: "10%", right: "5%", filter: "blur(100px)" }} />
      <div style={{ position: "absolute", width: 350, height: 350, borderRadius: "50%", opacity: 0.08,
        background: `radial-gradient(circle, ${CRIMSON2} 0%, transparent 70%)`, bottom: "20%", left: "10%", filter: "blur(80px)" }} />
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
      {/* Number + label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          height: 1,
          width: isActive ? 24 : 16,
          backgroundColor: isActive ? section.accentColor : "rgba(245,240,232,0.15)",
          transition: "all 0.5s",
        }} />
        <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: "0.6rem", letterSpacing: "0.2em", color: section.accentColor }}>
          {section.number}
        </span>
        <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: "0.5rem", letterSpacing: "0.15em", color: "rgba(245,240,232,0.3)", textTransform: "uppercase" }}>
          {section.label}
        </span>
        {/* Pulse dot */}
        {isActive && (
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: section.accentColor, animation: "rvPulseDot 1.5s ease-in-out infinite" }} />
        )}
      </div>

      {/* Period badge */}
      {section.period && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            display: "inline-block",
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            padding: "4px 12px",
            border: `1px solid ${section.accentColor}44`,
            color: section.accentColor,
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        >
          {section.period}
        </motion.span>
      )}

      {/* Title */}
      <h2 style={{
        fontFamily: "'Sora', 'Space Grotesk', sans-serif",
        fontWeight: 800,
        fontSize: "clamp(1.4rem, 3vw, 2.5rem)",
        color: "#F5F0E8",
        marginBottom: 8,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      }}>
        {section.title}
      </h2>

      {/* Subtitle */}
      {section.subtitle && (
        <p style={{ fontFamily: "'Space Grotesk', monospace", fontSize: "0.875rem", color: section.accentColor, marginBottom: 20 }}>
          {section.subtitle}
        </p>
      )}

      {/* Content bullets */}
      {section.content.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, maxWidth: 580 }}>
          {section.content.map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: isActive ? 1 : 0.3, x: isActive ? 0 : -5 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem", color: "rgba(245,240,232,0.7)", lineHeight: 1.7 }}
            >
              <span style={{ color: section.accentColor, flexShrink: 0, marginTop: 2 }}>▸</span>
              {item}
            </motion.li>
          ))}
        </ul>
      )}

      {/* Skills tags */}
      {isSkills && section.tags && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 580 }}>
          {section.tags.map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.9 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}
              style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "5px 12px",
                border: `1px solid ${CRIMSON}33`,
                background: `${CRIMSON}08`,
                color: "rgba(245,240,232,0.8)",
                transition: "all 0.3s ease",
              }}
            >
              {tag}
            </motion.span>
          ))}
        </div>
      )}

      {/* Contact links */}
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
            border: `1px solid ${CRIMSON}66`,
            color: BONE,
            textDecoration: "none",
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            transition: "all 0.3s",
            background: `${CRIMSON}0a`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CRIMSON, flexShrink: 0 }} />
            jkendrick0610@gmail.com
          </a>
          <a href="tel:+16095005660" style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 20px",
            border: `1px solid ${CRIMSON2}66`,
            color: BONE,
            textDecoration: "none",
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            transition: "all 0.3s",
            background: `${CRIMSON2}0a`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CRIMSON2, flexShrink: 0 }} />
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
          title={s.label}
        >
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.5rem",
            letterSpacing: "0.15em",
            color: i === activeIndex ? s.accentColor : "rgba(245,240,232,0.2)",
            opacity: i === activeIndex ? 1 : 0,
            transition: "all 0.3s",
          }}>
            {s.number}
          </span>
          <div style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? s.accentColor : "rgba(245,240,232,0.12)",
            width: i === activeIndex ? 32 : 10,
            boxShadow: i === activeIndex ? `0 0 8px ${s.accentColor}66` : "none",
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
      {/* Scroll progress line — matches site's crimson gradient */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 2,
        zIndex: 50,
        background: `linear-gradient(90deg, ${CRIMSON}, ${CRIMSON2})`,
        boxShadow: `0 0 8px ${CRIMSON}cc`,
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
        background: "linear-gradient(to bottom, rgba(10,10,10,0.85) 0%, transparent 100%)",
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: CRIMSON,
            fontFamily: "'Space Grotesk', monospace",
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            transition: "all 0.3s",
          }}
        >
          ← Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* JK logo — matches site header */}
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 900,
            fontSize: "1.1rem",
            color: CRIMSON,
            textShadow: `0 0 8px ${CRIMSON}cc`,
            letterSpacing: "-0.5px",
          }}>
            JK
          </span>
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.55rem",
            letterSpacing: "0.15em",
            color: "rgba(245,240,232,0.2)",
            textTransform: "uppercase",
          }}>
            Mission Dossier
          </span>
          {/* Pulsing dot */}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: CRIMSON, boxShadow: `0 0 6px ${CRIMSON}`, animation: "rvPulse 2s infinite" }} />
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
      {/* 3D Background */}
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

      {/* Grid overlay — crimson tint matching site's grid-bg */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        backgroundImage: `linear-gradient(${CRIMSON}08 1px, transparent 1px), linear-gradient(90deg, ${CRIMSON}08 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      {/* Scan line — crimson, matching site style */}
      <div style={{
        position: "absolute",
        left: 0,
        width: "100%",
        height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${CRIMSON}99 30%, ${CRIMSON}cc 50%, ${CRIMSON}99 70%, transparent 100%)`,
        zIndex: 2,
        pointerEvents: "none",
        opacity: 0.4,
        animation: "rvScanMove 4s linear infinite",
      }} />

      {/* Top bar */}
      <TopBar onBack={onBack} progress={scrollProgress} />

      {/* Side nav */}
      <SideNav activeIndex={activeIndex} />

      {/* Scrollable content */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: `${CRIMSON}55 transparent`,
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
              maxWidth: 560,
              margin: "0 0 0 8%",
              padding: "96px 24px",
              width: "100%",
            }}>
              <SectionContent section={section} isActive={i === activeIndex} />
            </div>
          </section>
        ))}

        {/* Download CTA — full-width section before footer */}
        <section style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 10,
          flexDirection: "column",
          gap: 40,
          padding: "80px 24px",
          textAlign: "center",
        }}>
          <div style={{
            width: 1,
            height: 80,
            background: `linear-gradient(to bottom, transparent, ${CRIMSON}66)`,
            margin: "0 auto",
          }} />
          <div>
            <p style={{
              fontFamily: "'Space Grotesk', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              color: `${CRIMSON}`,
              textTransform: "uppercase",
              marginBottom: 16,
            }}>
              END OF DOSSIER
            </p>
            <h2 style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2rem, 5vw, 4rem)",
              color: BONE,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: 16,
            }}>
              Want the full file?
            </h2>
            <p style={{
              fontFamily: "'Space Grotesk', monospace",
              fontSize: "0.875rem",
              color: "rgba(245,240,232,0.4)",
              maxWidth: 400,
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}>
              Download a clean PDF copy of the complete resume to share or review offline.
            </p>
            <a
              href="/resume.pdf"
              download="Jaivien-Kendrick-Resume.pdf"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "18px 40px",
                background: CRIMSON,
                color: BONE,
                textDecoration: "none",
                fontFamily: "'Space Grotesk', monospace",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                transition: "all 0.3s",
                boxShadow: `0 0 32px ${CRIMSON}55`,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Resume PDF
            </a>
          </div>
          <div style={{
            width: 1,
            height: 80,
            background: `linear-gradient(to top, transparent, ${CRIMSON}66)`,
            margin: "0 auto",
          }} />
        </section>

        {/* Footer */}
        <footer style={{
          position: "relative",
          zIndex: 10,
          padding: "32px 24px",
          borderTop: `1px solid ${CRIMSON}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: "0.55rem",
            color: "rgba(245,240,232,0.15)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            JAIVIEN KENDRICK // 2025
          </span>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Space Grotesk', monospace",
              fontWeight: 700,
              fontSize: "0.6rem",
              color: `${CRIMSON}88`,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              transition: "color 0.3s",
            }}
          >
            ← Back to Home
          </button>
        </footer>
      </div>


      <style>{`
        @keyframes rvScanMove {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes rvPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px ${CRIMSON}; }
          50% { opacity: 0.35; box-shadow: 0 0 2px ${CRIMSON}; }
        }
        @keyframes rvPulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
