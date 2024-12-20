"use strict";

import { parseOBJ, parseMTL } from './parse.js';
import { vs, fs } from './shaders.js';

async function main() {

  function loadTexture(gl, url) {
    console.log(`Loading texture from: ${url}`);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
  
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const placeholderPixel = new Uint8Array([255, 0, 0, 255]); 
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, placeholderPixel);
  
  
    const image = new Image();
    image.onload = function() {
      console.log(`Texture loaded successfully: ${url}`);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
      
     
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    };

    image.onerror = function() {
      console.error(`Failed to load texture: ${url}`);
    };
  
    image.src = url;
  
    return texture;
  }

  async function loadMaterialsAndTextures(gl, materials, baseHref) {
    for (const materialName in materials) {
      const material = materials[materialName];
      if (material.texturePath) {
        const textureUrl = new URL(material.texturePath, baseHref).href;
        try {
          material.texture = await loadTexture(gl, textureUrl);
          console.log(`Texture loaded for material: ${materialName}`);
        } catch (error) {
          console.error(`Failed to load texture for material: ${materialName}`, error);
          material.texture = null;
        }
      } else {
        material.texture = null;
      }
    }
  }  
  
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) {
      return;
    }
  
    
    const meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);
  
    const objHref = 'assets/models/nintendoswitch.obj';

    const response = await fetch('assets/models/nintendoswitch.obj');
    const texture = loadTexture(gl, 'assets/textures/texture.jpg');
    const text = await response.text();
    const obj = parseOBJ(text);
    const baseHref = new URL('assets/models/nintendoswitch.obj', window.location.href);
    const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    }));
    const materials = parseMTL(matTexts.join('\n'));
    await loadMaterialsAndTextures(gl, materials, baseHref);

    Object.keys(materials).forEach((materialName) => {
      const material = materials[materialName];
      if (material.diffuseMap) {

        const textureUrl = `textures/texture.jpg`;
        console.log(`Loading texture for material ${materialName} from: ${textureUrl}`);
        material.texture = loadTexture(gl, textureUrl);
      } else {
        console.warn(`Material ${materialName} does not have a diffuseMap.`);
        material.texture = null; 
      }
    });

    console.log(materials);

    const defaultMaterial = {
      diffuse: [1, 1, 1],
      ambient: [0, 0, 0],
      specular: [1, 1, 1],
      shininess: 400,
      opacity: 1,
    };Object
  
    const parts = obj.geometries.map(({ material, data }) => {
       
        const materialInfo = materials[material] || defaultMaterial;
      
       
        if (data.color) {
          if (data.position.length === data.color.length) {
            
            data.color = { numComponents: 3, data: data.color };
          }
        } else {
          
          data.color = { value: materialInfo.diffuse ? [...materialInfo.diffuse, 1] : [1, 1, 1, 1] };
        }

        
        
        const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
        return {
          material: materialInfo,
          bufferInfo,
          texture: texture,
        };
    });
      
  
    function getExtents(positions) {
      const min = positions.slice(0, 3);
      const max = positions.slice(0, 3);
      for (let i = 3; i < positions.length; i += 3) {
        for (let j = 0; j < 3; ++j) {
          const v = positions[i + j];
          min[j] = Math.min(v, min[j]);
          max[j] = Math.max(v, max[j]);
        }
      }
      return {min, max};
    }
  
    function getGeometriesExtents(geometries) {
      return geometries.reduce(({min, max}, {data}) => {
        const minMax = getExtents(data.position);
        return {
          min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
          max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
        };
      }, {
        min: Array(3).fill(Number.POSITIVE_INFINITY),
        max: Array(3).fill(Number.NEGATIVE_INFINITY),
      });
    }
  
    const extents = getGeometriesExtents(obj.geometries);
    const range = m4.subtractVectors(extents.max, extents.min);
    
    const objOffset = m4.scaleVector(
        m4.addVectors(
          extents.min,
          m4.scaleVector(range, 0.5)),
        -1);
    const cameraTarget = [0, 0, 0];
    
    const radius = m4.length(range) * 1.2;
    const cameraPosition = m4.addVectors(cameraTarget, [
      0,
      0,
      radius,
    ]);
    
    const zNear = radius / 100;
    const zFar = radius * 3;
  
    function degToRad(deg) {
      return deg * Math.PI / 180;
    }
  
    function render(time) {
      time *= 0.001;
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
      const fieldOfViewRadians = degToRad(60);
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
  
      const up = [0, 1, 0];
      
      const camera = m4.lookAt(cameraPosition, cameraTarget, up);
  
      const view = m4.inverse(camera);
  
      const sharedUniforms = {
        u_lightDirection: m4.normalize([-1, 3, 5]),
        u_view: view,
        u_projection: projection,
        u_viewWorldPosition: cameraPosition,
        u_ambientLight: [0.2, 0.2, 0.2],
      };
  
      gl.useProgram(meshProgramInfo.program);
  
      webglUtils.setUniforms(meshProgramInfo, sharedUniforms);
  
      let u_world = m4.yRotation(time);
      u_world = m4.translate(u_world, ...objOffset);
  
      for (const {bufferInfo, material, texture} of parts) {
        webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
        
        const materialUniforms = {
          diffuse: material.diffuse || [1, 1, 1],
          ambient: material.ambient || [0, 0, 0],
          specular: material.specular || [1, 1, 1],
          shininess: material.shininess || 400,
          opacity: material.opacity || 1,
        };
  
        webglUtils.setUniforms(meshProgramInfo, {
          u_world,
          ...materialUniforms,
        });

        if (material.texture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, material.texture);
          gl.uniform1i(gl.getUniformLocation(meshProgramInfo.program, "u_texture"), 0);
          console.log(`Texture for material bound successfully.`);
        } else {
          console.warn(`Texture is not available for material:`, material);
        }
  
        webglUtils.drawBufferInfo(gl, bufferInfo);
      }
  
      requestAnimationFrame(render);
    }
    
    requestAnimationFrame(render);
  }
  
  main().catch(console.error);
  
  window.addEventListener('load', () => {
    if (window.webglUtils && window.m4) {
      main();
    } else {
      console.error('Required WebGL utility libraries are not loaded.');
    }
  });
  
  export default main;