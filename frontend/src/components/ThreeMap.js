import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { apiUtils } from '../services/api';
import './ThreeMap.css';

const ThreeMap = ({ buildings, highlightedBuildings = [], onBuildingSelect, targetArea }) => {
  const mapRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const buildingsGroupRef = useRef(null);
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!mapRef.current) return;



    try {
      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB); // Sky blue
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        60,
        mapRef.current.clientWidth / mapRef.current.clientHeight,
        1,
        10000
      );
      camera.position.set(0, 300, 400);
      cameraRef.current = camera;


      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mapRef.current.clientWidth, mapRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // DEBUG: Style the canvas
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.border = '3px solid blue'; // DEBUG: Blue border for canvas
      
      mapRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 50;
      controls.maxDistance = 1000;
      controlsRef.current = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(100, 200, 100);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);

      // Ground plane
      const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Grid helper
      const gridHelper = new THREE.GridHelper(1000, 20, 0x444444, 0x888888);
      scene.add(gridHelper);

      // Buildings group
      const buildingsGroup = new THREE.Group();
      scene.add(buildingsGroup);
      buildingsGroupRef.current = buildingsGroup;

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!mapRef.current || !camera || !renderer) return;
        
        const width = mapRef.current.clientWidth;
        const height = mapRef.current.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);

      setIsInitialized(true);
      console.log('3D city map initialized successfully');

    } catch (error) {
      console.error('Failed to initialize 3D scene:', error);
    }
  }, []);

  // Create simple buildings
  const createBuildings = useCallback(() => {
    if (!buildingsGroupRef.current || !buildings || buildings.length === 0) return;

    

    try {
      // Clear existing buildings
      buildingsGroupRef.current.clear();

      let createdCount = 0;
      buildings.forEach((building, index) => {
        try {
          // Get building properties
          const props = building.properties || {};
          const height = Math.min((props.height_m || 10) * 0.1, 50); // Scale height
          const buildingType = props.building_type || 'unknown';
          const isHighlighted = (highlightedBuildings || []).some(hb => hb.id === building.id);



          // Create larger, more visible buildings
          const width = 30 + Math.random() * 20; // Random width 30-50
          const depth = 30 + Math.random() * 20; // Random depth 30-50
          const buildingHeight = Math.max(height, 20); // Minimum height of 20
          
          const geometry = new THREE.BoxGeometry(width, buildingHeight, depth);
          const material = new THREE.MeshLambertMaterial({ 
            color: apiUtils.getBuildingColor(buildingType, isHighlighted),
            transparent: false,
            opacity: 1.0
          });
          
          // Make buildings interactive
          material.transparent = true;
          material.opacity = 0.9;

          const mesh = new THREE.Mesh(geometry, material);
          
          // Position buildings in a more spread out grid pattern
          const row = Math.floor(index / 6); // 6 buildings per row
          const col = index % 6;
          const x = (col - 2.5) * 120; // More spread out
          const z = (row - 2.5) * 120;
          
          mesh.position.set(x, buildingHeight / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.building = building;
          mesh.userData.buildingIndex = index;
          
          buildingsGroupRef.current.add(mesh);
          createdCount++;



        } catch (error) {
          // Silently handle building creation errors
        }
      });





    } catch (error) {
      // Silently handle building creation errors
    }
  }, [buildings, highlightedBuildings]);

  // Initialize scene on mount
  useEffect(() => {
    if (buildings && buildings.length > 0) {
      initScene();
    }
  }, [buildings, initScene]);

  // Create buildings when scene is initialized
  useEffect(() => {
    if (isInitialized) {
      createBuildings();
    }
  }, [createBuildings, isInitialized]);

  // Add click event handling for buildings
  useEffect(() => {
    if (!mapRef.current || !isInitialized) return;

    const handleClick = (event) => {
      event.preventDefault();
      
      const mouse = new THREE.Vector2();
      const rect = mapRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      if (buildingsGroupRef.current) {
        const intersects = raycaster.intersectObjects(buildingsGroupRef.current.children, true);
        
        if (intersects.length > 0) {
          const clickedBuilding = intersects[0].object;
          const buildingIndex = clickedBuilding.userData.buildingIndex;
          
          if (buildingIndex !== undefined && buildings[buildingIndex]) {
            console.log('Building clicked!', buildings[buildingIndex]); // Debug log
            onBuildingSelect(buildings[buildingIndex]);
          }
        }
      }
    };

    const handleMouseMove = (event) => {
      if (!mapRef.current || !isInitialized) return;
      
      const mouse = new THREE.Vector2();
      const rect = mapRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      if (buildingsGroupRef.current) {
        const intersects = raycaster.intersectObjects(buildingsGroupRef.current.children, true);
        
        // Reset all building materials
        buildingsGroupRef.current.children.forEach(child => {
          if (child.material) {
            child.material.opacity = 0.9;
          }
        });
        
        // Highlight hovered building
        if (intersects.length > 0) {
          const hoveredBuilding = intersects[0].object;
          if (hoveredBuilding.material) {
            hoveredBuilding.material.opacity = 1.0;
            mapRef.current.style.cursor = 'pointer';
          }
        } else {
          mapRef.current.style.cursor = 'default';
        }
      }
    };

    mapRef.current.addEventListener('click', handleClick);
    mapRef.current.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      if (mapRef.current) {
        mapRef.current.removeEventListener('click', handleClick);
        mapRef.current.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [isInitialized, buildings, onBuildingSelect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="three-map">
      <div ref={mapRef} className="map-container" />
      
      {!isInitialized && (
        <div className="map-loading">
          <p>Loading 3D city map...</p>
        </div>
      )}





      {/* Map Controls Info */}
      <div className="map-controls-info">
        <h4>Map Controls</h4>
        <p>• Drag to rotate • Scroll to zoom • Right-click to pan</p>
        <p>• Click on buildings to see details</p>
      </div>
    </div>
  );
};

export default ThreeMap;
