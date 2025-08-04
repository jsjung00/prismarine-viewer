/* global THREE */
const { WorldView, Viewer } = require('prismarine-viewer/viewer')
const { Vec3 } = require('vec3')
const Chunk = require('prismarine-chunk')
const mcData = require('minecraft-data')
global.THREE = require('three')

// Create a world that returns actual chunk objects
class LocalWorld {
  constructor(version = '1.12.2') {
    this.version = version
    this.Chunk = Chunk(version)
    this.mcData = mcData(version)
    
    console.log('Creating world with version:', version)
    console.log('Stone block ID:', this.mcData.blocksByName.stone.id)
  }
  
  async getColumnAt(pos) {
    const chunkX = Math.floor(pos.x / 16)
    const chunkZ = Math.floor(pos.z / 16)
    
    console.log(`getColumnAt called for chunk ${chunkX}, ${chunkZ}`)
    
    // Create a new chunk
    const chunk = new this.Chunk()
    
    // Fill with some blocks
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        // Bedrock at y=0
        chunk.setBlockType(new Vec3(x, 0, z), this.mcData.blocksByName.bedrock.id)
        
        // Stone floor at y=1-10
        for (let y = 1; y <= 10; y++) {
          chunk.setBlockType(new Vec3(x, y, z), this.mcData.blocksByName.stone.id)
        }
        
        // Add a marker block every 4 blocks for visibility
        if (x % 4 === 0 && z % 4 === 0) {
          chunk.setBlockType(new Vec3(x, 11, z), this.mcData.blocksByName.glowstone.id)
        }
      }
    }
    
    // Add a tall pillar in the center of each chunk for reference
    if (chunkX === 2 && chunkZ === 2) {
      for (let y = 11; y < 30; y++) {
        chunk.setBlockType(new Vec3(8, y, 8), this.mcData.blocksByName.gold_block.id)
      }
    }
    
    return chunk
  }
  
  getBlock(pos) {
    const chunkX = Math.floor(pos.x / 16)
    const chunkZ = Math.floor(pos.z / 16)
    const chunk = this.getColumnAt({ x: chunkX * 16, z: chunkZ * 16 })
    
    if (!chunk) {
      return {
        type: 0,
        name: 'air',
        boundingBox: 'empty',
        transparent: true,
        position: pos,
        stateId: 0
      }
    }
    
    const localPos = new Vec3(
      Math.floor(pos.x) & 15,
      Math.floor(pos.y),
      Math.floor(pos.z) & 15
    )
    
    return chunk.getBlock(localPos)
  }
  
  raycast(start, end, maxDistance) {
    return null
  }
}

async function main() {
  const viewDistance = 6
  const version = '1.12.2'
  
  console.log('Starting debug viewer...')
  console.log('Look for:')
  console.log('- Stone floor at Y=0-10')
  console.log('- Glowstone markers every 4 blocks at Y=11')
  console.log('- Gold pillar at chunk 2,2')
  
  // Create our local world
  const world = new LocalWorld(version)
  
  // Start position (above the floor)
  const center = new Vec3(32, 20, 32)
  
  const worldView = new WorldView(world, viewDistance, center)
  
  // Create three.js context
  const renderer = new THREE.WebGLRenderer()
  renderer.setPixelRatio(window.devicePixelRatio || 1)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)
  
  // Set a sky color so we can see something
  renderer.setClearColor(0x87CEEB, 1)
  
  // Create viewer
  const viewer = new Viewer(renderer)
  if (!viewer.setVersion(version)) {
    console.error('Version not supported')
    return false
  }
  
  // Add ambient light to see blocks better
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  viewer.scene.add(ambientLight)
  
  // Initialize worldView
  console.log('Initializing world view...')
  await worldView.init(center)
  
  // Link WorldView and Viewer
  viewer.listen(worldView)
  viewer.camera.position.set(center.x, center.y, center.z)
  
  // Log camera position
  console.log('Camera starting at:', viewer.camera.position)
  
  // Simple camera controls
  let yaw = 0
  let pitch = 0
  const moveSpeed = 0.5
  const keys = {}
  
  // Mouse look
  function moveCallback(e) {
    pitch -= e.movementY * 0.01
    yaw -= e.movementX * 0.01
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch))
    // Only update rotation, not position
    viewer.setFirstPersonCamera(null, yaw, pitch)
  }
  
  function changeCallback() {
    if (document.pointerLockElement === renderer.domElement) {
      document.addEventListener('mousemove', moveCallback, false)
    } else {
      document.removeEventListener('mousemove', moveCallback, false)
    }
  }
  
  document.addEventListener('pointerlockchange', changeCallback, false)
  
  renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock()
  })
  
  // Keyboard controls
  document.addEventListener('keydown', (e) => { keys[e.code] = true })
  document.addEventListener('keyup', (e) => { keys[e.code] = false })
  
  // Movement update
  function updateMovement() {
    const forward = new Vec3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const right = new Vec3(-Math.sin(yaw - Math.PI/2), 0, -Math.cos(yaw - Math.PI/2))
    
    if (keys['KeyW']) viewer.camera.position.add(forward.scaled(moveSpeed))
    if (keys['KeyS']) viewer.camera.position.sub(forward.scaled(moveSpeed))
    if (keys['KeyA']) viewer.camera.position.sub(right.scaled(moveSpeed))
    if (keys['KeyD']) viewer.camera.position.add(right.scaled(moveSpeed))
    if (keys['Space']) viewer.camera.position.y += moveSpeed
    if (keys['ShiftLeft']) viewer.camera.position.y -= moveSpeed
    
    worldView.updatePosition(viewer.camera.position)
  }
  
  // Animation loop
  const animate = () => {
    window.requestAnimationFrame(animate)
    updateMovement()
    viewer.update()
    renderer.render(viewer.scene, viewer.camera)
  }
  animate()
  
  // Add position display
  setInterval(() => {
    const pos = viewer.camera.position
    console.log(`Camera at: ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`)
  }, 3000)
  
  console.log('Viewer ready! Click to enable mouse look. Use WASD to move, Space/Shift for up/down.')
}

main().catch(console.error)