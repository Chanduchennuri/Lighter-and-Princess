import { useEffect, useRef } from "react"

interface OrbitSystem {
  x: number
  y: number
  baseX: number
  baseY: number
  radiusX: number
  radiusY: number
  rotation: number
  speed: number
  phase: number
  nodes: number
  lineAlpha: number
  nodeAlpha: number
}

interface Particle {
  x: number
  y: number
  baseX: number
  baseY: number
  size: number
  alpha: number
  drift: number
  phase: number
  vx: number
  vy: number
}

const PARTICLE_COUNT = 36
const MAX_PIXEL_RATIO = 1.5
const FRAME_INTERVAL = 1000 / 30

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function createOrbitSystems(width: number, height: number): OrbitSystem[] {
  const scale = Math.min(width, height)

  return [
    {
      x: width * 0.08,
      y: height * 0.2,
      baseX: width * 0.08,
      baseY: height * 0.2,
      radiusX: scale * 0.16,
      radiusY: scale * 0.07,
      rotation: -0.32,
      speed: 0.00034,
      phase: 0.3,
      nodes: 4,
      lineAlpha: 0.32,
      nodeAlpha: 0.6,
    },
    {
      x: width * 0.92,
      y: height * 0.18,
      baseX: width * 0.92,
      baseY: height * 0.18,
      radiusX: scale * 0.17,
      radiusY: scale * 0.065,
      rotation: 0.42,
      speed: -0.00027,
      phase: 2.1,
      nodes: 5,
      lineAlpha: 0.3,
      nodeAlpha: 0.55,
    },
    {
      x: width * 0.07,
      y: height * 0.82,
      baseX: width * 0.07,
      baseY: height * 0.82,
      radiusX: scale * 0.19,
      radiusY: scale * 0.075,
      rotation: 0.28,
      speed: -0.00023,
      phase: 1.6,
      nodes: 4,
      lineAlpha: 0.28,
      nodeAlpha: 0.55,
    },
    {
      x: width * 0.93,
      y: height * 0.83,
      baseX: width * 0.93,
      baseY: height * 0.83,
      radiusX: scale * 0.18,
      radiusY: scale * 0.07,
      rotation: -0.25,
      speed: 0.00022,
      phase: 3.2,
      nodes: 5,
      lineAlpha: 0.28,
      nodeAlpha: 0.55,
    },
    {
      x: width * 0.5,
      y: height * 0.5,
      baseX: width * 0.5,
      baseY: height * 0.5,
      radiusX: width * 0.45,
      radiusY: height * 0.28,
      rotation: -0.08,
      speed: 0.00008,
      phase: 0.8,
      nodes: 7,
      lineAlpha: 0.14,
      nodeAlpha: 0.35,
    },
  ]
}

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const x = Math.random() * width
    const y = Math.random() * height
    return {
      x,
      y,
      baseX: x,
      baseY: y,
      size: 0.8 + Math.random() * 1.8,
      alpha: 0.12 + Math.random() * 0.25,
      drift: 0.15 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
    }
  })
}

export function PhysicsBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 })

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) return

    const context = canvasElement.getContext("2d")
    if (!context) return

    let width = 0
    let height = 0
    let pixelRatio = 1
    let canvasLeft = 0
    let canvasTop = 0

    let orbitSystems: OrbitSystem[] = []
    let particles: Particle[] = []
    let lastFrameTime = 0

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      mouseRef.current.targetX = clientX - canvasLeft
      mouseRef.current.targetY = clientY - canvasTop
    }

    const handlePointerLeave = () => {
      mouseRef.current.targetX = -1000
      mouseRef.current.targetY = -1000
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerleave", handlePointerLeave)

    function resize() {
      const rect = canvasElement!.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvasLeft = rect.left
      canvasTop = rect.top
      pixelRatio = clamp(
        window.devicePixelRatio || 1,
        1,
        MAX_PIXEL_RATIO,
      )

      canvasElement!.width = Math.round(width * pixelRatio)
      canvasElement!.height = Math.round(height * pixelRatio)
      canvasElement!.style.width = `${width}px`
      canvasElement!.style.height = `${height}px`

      context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

      orbitSystems = createOrbitSystems(width, height)
      particles = createParticles(width, height)
    }

    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvasElement)

    function drawNode(x: number, y: number, size: number, alpha: number) {
      context!.beginPath()
      context!.arc(x, y, size + 3.5, 0, Math.PI * 2)
      context!.strokeStyle = `rgba(51, 65, 85, ${alpha * 0.45})`
      context!.lineWidth = 0.8
      context!.stroke()

      context!.beginPath()
      context!.arc(x, y, size, 0, Math.PI * 2)
      context!.fillStyle = `rgba(15, 23, 42, ${alpha})`
      context!.fill()

      context!.beginPath()
      context!.arc(x - size * 0.3, y - size * 0.3, size * 0.35, 0, Math.PI * 2)
      context!.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`
      context!.fill()
    }

    function drawOrbit(system: OrbitSystem, time: number) {
      const angle = system.phase + time * system.speed

      context!.save()
      context!.translate(system.x, system.y)
      context!.rotate(system.rotation)

      context!.beginPath()
      context!.ellipse(0, 0, system.radiusX, system.radiusY, 0, 0, Math.PI * 2)
      context!.strokeStyle = `rgba(30, 41, 59, ${system.lineAlpha})`
      context!.lineWidth = 1.1
      context!.stroke()

      context!.beginPath()
      context!.ellipse(0, 0, system.radiusX * 0.76, system.radiusY * 1.32, 0, 0, Math.PI * 2)
      context!.strokeStyle = `rgba(100, 116, 139, ${system.lineAlpha * 0.65})`
      context!.lineWidth = 0.65
      context!.stroke()

      context!.beginPath()
      context!.moveTo(-system.radiusX * 1.05, 0)
      context!.lineTo(system.radiusX * 1.05, 0)
      context!.strokeStyle = `rgba(15, 23, 42, ${system.lineAlpha * 0.3})`
      context!.lineWidth = 0.5
      context!.stroke()

      context!.beginPath()
      context!.arc(0, 0, 3, 0, Math.PI * 2)
      context!.fillStyle = `rgba(15, 23, 42, ${system.nodeAlpha * 0.8})`
      context!.fill()

      for (let i = 0; i < system.nodes; i++) {
        const theta = angle + (i / system.nodes) * Math.PI * 2
        const nx = system.radiusX * Math.cos(theta)
        const ny = system.radiusY * Math.sin(theta)

        drawNode(nx, ny, 2.5, system.nodeAlpha)

        context!.beginPath()
        context!.moveTo(nx * 0.72, ny * 0.72)
        context!.lineTo(nx, ny)
        context!.strokeStyle = `rgba(71, 85, 105, ${system.lineAlpha * 0.5})`
        context!.lineWidth = 0.6
        context!.stroke()
      }

      context!.restore()
    }

    function drawParticles(time: number) {
      const mouse = mouseRef.current

      mouse.x += (mouse.targetX - mouse.x) * 0.1
      mouse.y += (mouse.targetY - mouse.y) * 0.1

      for (const p of particles) {
        const targetX =
          p.baseX + Math.sin(time * 0.00015 * p.drift + p.phase) * 10
        const targetY =
          p.baseY + Math.cos(time * 0.00012 * p.drift + p.phase) * 8

        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy)
        const maxDist = 140

        if (dist < maxDist && dist > 0) {
          const force = (1 - dist / maxDist) * 12
          p.vx -= (dx / dist) * force * 0.1
          p.vy -= (dy / dist) * force * 0.1
        }

        p.vx *= 0.92
        p.vy *= 0.92

        p.x += (targetX - p.x) * 0.05 + p.vx
        p.y += (targetY - p.y) * 0.05 + p.vy

        context!.beginPath()
        context!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        context!.fillStyle = `rgba(30, 41, 59, ${p.alpha})`
        context!.fill()
      }
    }

    function drawLPLogo(time: number) {
      if (width <= 0 || height <= 0) return

      const cycle = (time * 0.000018) % 1
      const x = -80 + (width + 160) * cycle
      const wave = Math.sin(cycle * Math.PI * 4)
      const secondaryWave = Math.sin(cycle * Math.PI * 10) * 0.12
      const baseY = height * 0.18
      const amplitude = Math.max(35, height * 0.1)
      const y = baseY + (wave + secondaryWave) * amplitude

      const derivative =
        Math.cos(cycle * Math.PI * 4) * Math.PI * 4 +
        Math.cos(cycle * Math.PI * 10) * Math.PI * 10 * 0.12
      const rotation = Math.atan2(derivative, 1) * 0.35

      context!.save()
      context!.translate(x, y)
      context!.rotate(rotation)

      context!.beginPath()
      for (let i = 0; i <= 10; i++) {
        const trailT = Math.max(0, cycle - i * 0.0032)
        const trailX = -80 + (width + 160) * trailT - x
        const trailWave = Math.sin(trailT * Math.PI * 4)
        const trailSecondary = Math.sin(trailT * Math.PI * 10) * 0.12
        const trailY = baseY + (trailWave + trailSecondary) * amplitude - y

        if (i === 0) context!.moveTo(trailX, trailY)
        else context!.lineTo(trailX, trailY)
      }
      context!.strokeStyle = "rgba(71, 85, 105, 0.12)"
      context!.lineWidth = 1
      context!.stroke()

      context!.beginPath()
      context!.arc(0, 0, 32, 0, Math.PI * 2)
      context!.strokeStyle = "rgba(15, 23, 42, 0.18)"
      context!.lineWidth = 0.8
      context!.stroke()

      context!.beginPath()
      context!.arc(0, 0, 38, 0, Math.PI * 2)
      context!.strokeStyle = "rgba(148, 163, 184, 0.18)"
      context!.lineWidth = 0.6
      context!.stroke()

      context!.beginPath()
      context!.moveTo(-20, -14)
      context!.lineTo(-20, 14)
      context!.lineTo(-6, 14)
      context!.strokeStyle = "rgba(15, 23, 42, 0.65)"
      context!.lineWidth = 2.2
      context!.lineCap = "round"
      context!.lineJoin = "round"
      context!.stroke()

      context!.beginPath()
      context!.arc(2, -6, 7, 0, Math.PI * 1.65)
      context!.strokeStyle = "rgba(15, 23, 42, 0.55)"
      context!.lineWidth = 1.8
      context!.stroke()

      context!.beginPath()
      context!.moveTo(0, 0)
      context!.lineTo(11, 11)
      context!.lineTo(18, -8)
      context!.strokeStyle = "rgba(15, 23, 42, 0.55)"
      context!.lineWidth = 1.8
      context!.stroke()

      context!.beginPath()
      context!.moveTo(22, -14)
      context!.lineTo(22, 14)
      context!.moveTo(22, -14)
      context!.lineTo(30, -14)
      context!.quadraticCurveTo(38, -14, 38, -6)
      context!.quadraticCurveTo(38, 2, 30, 2)
      context!.lineTo(22, 2)
      context!.strokeStyle = "rgba(15, 23, 42, 0.65)"
      context!.lineWidth = 2.2
      context!.lineCap = "round"
      context!.lineJoin = "round"
      context!.stroke()

      context!.restore()
    }

    function draw(timestamp: number) {
      if (
        !reducedMotion &&
        timestamp - lastFrameTime < FRAME_INTERVAL
      ) {
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      lastFrameTime = timestamp

      const time = reducedMotion ? 0 : timestamp

      context!.clearRect(0, 0, width, height)

      drawParticles(time)

      for (const system of orbitSystems) {
        drawOrbit(system, time)
      }

      drawLPLogo(time)

      if (!reducedMotion && !document.hidden) {
        frameRef.current = requestAnimationFrame(draw)
      }
    }

    if (!reducedMotion) {
      frameRef.current = requestAnimationFrame(draw)
    } else {
      draw(0)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        return
      }

      lastFrameTime = 0

      if (!reducedMotion && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(draw)
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    )

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerleave", handlePointerLeave)
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      )

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}