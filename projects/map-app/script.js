// Initialize the map and set its view
var map = L.map('map').setView([20, 0], 2);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Create a layer group to hold drawn items
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Set up the Leaflet.draw control
var drawControl = new L.Control.Draw({
  draw: {
    polyline: false,
    polygon: false,
    circle: false,
    marker: false,
    circlemarker: false,
    rectangle: false  // We'll enable this manually with the capture button
  },
  edit: {
    featureGroup: drawnItems,
    edit: false,
    remove: false
  }
});
map.addControl(drawControl);

// Define polygon drawing options
var polygonDrawOptions = {
  shapeOptions: {
    color: '#97009c',
    fillOpacity: 0.2
  },
  allowIntersection: false,
  drawError: {
    color: '#e1e100',
    message: '<strong>Error:</strong> shape edges cannot cross!'
  },
  guidelineDistance: 10,
  showLength: true,
  metric: true
};

// Constants
const BOX_LIMIT = 1500;
const H3_CELL_LIMIT = 2000;
const TILE_TYPES = {
  RECTANGLE: 'rectangle',
  H3: 'h3'
};

// DOM references
const gridSizeSlider = document.getElementById('gridSize');
const gridSizeManual = document.getElementById('gridSizeManual');
const infoDiv = document.getElementById('info');
const gridWarningDiv = document.getElementById('gridWarning');
const tileTypeSelector = document.getElementById('tileType');
const tableNameInput = document.getElementById('tableName');
const hexIdColumnInput = document.getElementById('hexIdColumn');
const latColumnInput = document.getElementById('latColumn');
const lngColumnInput = document.getElementById('lngColumn');

// Current selected tile type
let currentTileType = TILE_TYPES.RECTANGLE;

// Event listeners for drawing buttons
document.getElementById('polygonBtn').addEventListener('click', function() {
  enableGridControls();
  new L.Draw.Polygon(map, polygonDrawOptions).enable();
});

document.getElementById('captureBtn').addEventListener('click', function() {
  disableGridControls();
  new L.Draw.Rectangle(map).enable();
});

document.getElementById('deleteBtn').addEventListener('click', function() {
  drawnItems.clearLayers();
  infoDiv.innerHTML = '';
  disableGridControls();
});

// Grid size controls
gridSizeSlider.addEventListener('input', function(e) {
  updateGridSizeFromControl(parseFloat(e.target.value), 'slider');
});

gridSizeManual.addEventListener('input', function(e) {
  let value = parseFloat(e.target.value);
  value = Math.min(Math.max(value, 0.01), 10);
  updateGridSizeFromControl(value, 'manual');
});

// Tile type selector
tileTypeSelector.addEventListener('change', function(e) {
  currentTileType = e.target.value;
  updateTileControls();
  
  // If we have a polygon drawn, update the grid
  if (drawnItems.getLayers().length > 0) {
    const layer = drawnItems.getLayers()[0];
    if (layer instanceof L.Polygon) {
      // If switching to H3, find and set the optimal resolution
      if (currentTileType === TILE_TYPES.H3) {
        const coordinates = layer.getLatLngs()[0];
        const optimalResolution = findOptimalH3Resolution(coordinates);
        document.getElementById('h3Resolution').value = optimalResolution.toString();
        gridWarningDiv.textContent = `Using optimal resolution: ${optimalResolution}`;
      }
      redrawGrid(layer);
    }
  }
});

function updateTileControls() {
  if (currentTileType === TILE_TYPES.H3) {
    document.getElementById('h3ResolutionContainer').style.display = 'block';
    document.getElementById('gridSizeContainer').style.display = 'none';
    // Set to resolution 0 (largest tiles) by default
    document.getElementById('h3Resolution').value = '0';
  } else {
    document.getElementById('h3ResolutionContainer').style.display = 'none';
    document.getElementById('gridSizeContainer').style.display = 'block';
  }
}

// H3 resolution control
document.getElementById('h3Resolution').addEventListener('change', function(e) {
  if (drawnItems.getLayers().length > 0) {
    const layer = drawnItems.getLayers()[0];
    if (layer instanceof L.Polygon) {
      const resolution = parseInt(e.target.value);
      const coordinates = layer.getLatLngs()[0];
      
      // Estimate H3 cell count before rendering
      const estimatedCellCount = estimateH3CellCount(coordinates, resolution);
      
      if (estimatedCellCount > H3_CELL_LIMIT) {
        gridWarningDiv.textContent = `Resolution too high! Would create approximately ${estimatedCellCount} hexagons. Maximum is ${H3_CELL_LIMIT} hexagons.`;
        gridWarningDiv.style.color = 'red';
        // Revert to previous value
        e.target.value = e.target.dataset.lastValue || '0';
      } else {
        gridWarningDiv.textContent = `Estimated number of hexagons: ${estimatedCellCount}`;
        gridWarningDiv.style.color = 'black';
        // Store current value as last valid value
        e.target.dataset.lastValue = resolution;
        redrawGrid(layer);
      }
    }
  }
});

// Function to estimate H3 cell count
function estimateH3CellCount(coordinates, resolution) {
  try {
    // Find the bounding box of the polygon
    const bounds = findPolygonBounds(coordinates);
    
    // Calculate area in square degrees
    const areaInSqDegrees = (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
    
    // Approximate number of cells based on resolution
    // These are rough estimates of cells per square degree at different resolutions
    const cellsPerSqDegreeByResolution = {
      0: 0.0001,  // Very few cells at res 0
      1: 0.0005,
      2: 0.003,
      3: 0.02,
      4: 0.15,
      5: 1,       // Around 1 cell per square degree at res 5
      6: 7,
      7: 50,
      8: 350,
      9: 2450,
      10: 17150,
      11: 120050,
      12: 840350,
      13: 5882450,
      14: 41177150,
      15: 288240050
    };
    
    // Get the multiplier for the resolution or default to a high value
    const multiplier = cellsPerSqDegreeByResolution[resolution] || 
                      (resolution > 15 ? cellsPerSqDegreeByResolution[15] * Math.pow(7, resolution - 15) : 1);
    
    // Calculate estimated cell count
    const estimatedCount = Math.ceil(areaInSqDegrees * multiplier);
    
    // Sample a few points to improve the estimate for irregular polygons
    // This helps account for the actual shape vs. the bounding box
    const samplePoints = 5;
    let insideCount = 0;
    
    for (let i = 0; i < samplePoints; i++) {
      for (let j = 0; j < samplePoints; j++) {
        const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (i / (samplePoints - 1));
        const lng = bounds.minLng + (bounds.maxLng - bounds.minLng) * (j / (samplePoints - 1));
        
        if (isPointInPolygon({lat, lng}, coordinates)) {
          insideCount++;
        }
      }
    }
    
    // Adjust estimate based on the ratio of points inside the polygon
    const ratio = insideCount / (samplePoints * samplePoints);
    return Math.ceil(estimatedCount * ratio);
  } catch (error) {
    console.error("Error estimating H3 cell count:", error);
    // Return a conservative estimate
    return resolution > 8 ? H3_CELL_LIMIT + 1 : 1000;
  }
}

function updateGridSizeFromControl(value, source) {
  if (!updateGridSize(value)) {
    // If update failed, revert to previous valid value
    if (source === 'slider') {
      gridSizeSlider.value = gridSizeManual.value;
    } else {
      gridSizeManual.value = gridSizeSlider.value;
    }
  }
}

function updateGridSize(value) {    
  if (drawnItems.getLayers().length > 0) {
    const layer = drawnItems.getLayers()[0];
    if (layer instanceof L.Polygon) {
      if (currentTileType === TILE_TYPES.RECTANGLE) {
        const coordinates = layer.getLatLngs()[0];
        const numBoxes = estimateBoxCount(coordinates, value);
        
        if (numBoxes > BOX_LIMIT) {
          gridWarningDiv.textContent = `Grid size too small! Would create ${numBoxes} boxes. Maximum is ${BOX_LIMIT} boxes.`;
          gridWarningDiv.style.color = 'red';
          return false;
        } else {
          gridWarningDiv.textContent = `Current number of boxes: ${numBoxes}`;
          gridWarningDiv.style.color = 'black';
          
          // Update both inputs
          gridSizeSlider.value = value;
          gridSizeManual.value = value;
          
          redrawGrid(layer);
          return true;
        }
      }
    }
  }
  
  // If no polygon drawn, just update the values
  gridSizeSlider.value = value;
  gridSizeManual.value = value;
  return true;
}

function estimateBoxCount(coordinates, gridSize) {
  const minLat = Math.min(...coordinates.map(c => c.lat));
  const maxLat = Math.max(...coordinates.map(c => c.lat));
  const minLng = Math.min(...coordinates.map(c => c.lng));
  const maxLng = Math.max(...coordinates.map(c => c.lng));
  
  const latBoxes = Math.ceil((maxLat - minLat) / gridSize);
  const lngBoxes = Math.ceil((maxLng - minLng) / gridSize);
  
  return latBoxes * lngBoxes;
}

// Add tooltip and click-to-copy functionality for H3 cells
function addH3CellInteractivity(hexagonLayer, hexId) {
  // Add tooltip showing the H3 index on hover
  hexagonLayer.bindTooltip(hexId, {
    permanent: false,
    direction: 'center',
    className: 'h3-tooltip'
  });
  
  // Add click handler to copy the H3 index to clipboard
  hexagonLayer.on('click', function(e) {
    // Stop the click from propagating to the map
    L.DomEvent.stopPropagation(e);
    
    // Copy to clipboard
    navigator.clipboard.writeText(hexId)
      .then(() => {
        // Show a temporary success message
        const popup = L.popup({
          autoClose: true,
          closeOnClick: true,
          closeButton: false,
          offset: [0, -10],
          className: 'copy-popup'
        })
        .setLatLng(e.latlng)
        .setContent('H3 index copied to clipboard!')
        .openOn(map);
        
        // Close the popup after 1.5 seconds
        setTimeout(() => {
          map.closePopup(popup);
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy H3 index:', err);
        alert('Failed to copy to clipboard: ' + hexId);
      });
  });
  
  // Change cursor to pointer on hover to indicate clickability
  hexagonLayer.on('mouseover', function() {
    this.getElement().style.cursor = 'pointer';
  });
}

// Update the redrawGrid function to add interactivity to H3 cells
function redrawGrid(layer) {
  // Clear existing grid
  drawnItems.clearLayers();
  drawnItems.addLayer(layer);
  
  // Get the coordinates
  const coordinates = layer.getLatLngs()[0];
  
  if (currentTileType === TILE_TYPES.RECTANGLE) {
    // Draw rectangular grid
    const gridSize = parseFloat(gridSizeManual.value);
    const boxes = generateBoundingBoxes(coordinates, gridSize);
    
    // Visualize the grid boxes
    boxes.forEach(box => {
      var bounds = [
        [box.south_west.lat, box.south_west.lng],
        [box.north_east.lat, box.north_east.lng]
      ];
      L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(drawnItems);
    });
    
    // Update the info div
    updateRectangleGridInfo(boxes);
  } else {
    // Draw H3 hexagonal grid
    const resolution = parseInt(document.getElementById('h3Resolution').value);
    
    // Check estimated cell count before generating
    const estimatedCellCount = estimateH3CellCount(coordinates, resolution);
    
    if (estimatedCellCount > H3_CELL_LIMIT) {
      gridWarningDiv.textContent = `Resolution too high! Would create approximately ${estimatedCellCount} hexagons. Maximum is ${H3_CELL_LIMIT} hexagons.`;
      gridWarningDiv.style.color = 'red';
      // Still show the info but don't render on map
      updateH3GridInfo(hexagons, resolution);
      return;
    }
    
    gridWarningDiv.textContent = `Generating approximately ${estimatedCellCount} hexagons...`;
    
    const hexagons = generateH3Hexagons(coordinates, resolution);
    
    // Update warning with actual count
    if (hexagons.length > H3_CELL_LIMIT) {
      gridWarningDiv.textContent = `Too many hexagons generated: ${hexagons.length}. Maximum is ${H3_CELL_LIMIT}.`;
      gridWarningDiv.style.color = 'red';
      // Still show the info but don't render on map
      updateH3GridInfo(hexagons, resolution);
      return;
    }
    
    gridWarningDiv.textContent = `Number of hexagons: ${hexagons.length}`;
    gridWarningDiv.style.color = 'black';
    
    // Visualize the hexagons
    hexagons.forEach(hexId => {
      // Use cellToBoundary to get the hexagon vertices
      const hexBoundary = h3.cellToBoundary(hexId);
      // Convert to Leaflet format
      const latLngs = hexBoundary.map(point => [point[0], point[1]]);
      const hexagonLayer = L.polygon(latLngs, {
        color: "#5733FF", 
        weight: 1,
        fillOpacity: 0.2
      }).addTo(drawnItems);
      
      // Add hover and click functionality
      addH3CellInteractivity(hexagonLayer, hexId);
    });
    
    // Update the info div with hexagon information
    updateH3GridInfo(hexagons, resolution);
  }
}

function generateH3Hexagons(coordinates, resolution) {
  try {
    // Make sure the polygon is closed (first and last point are the same)
    let polygonCoords = [...coordinates];
    if (polygonCoords.length > 0 && 
        (polygonCoords[0].lat !== polygonCoords[polygonCoords.length-1].lat || 
         polygonCoords[0].lng !== polygonCoords[polygonCoords.length-1].lng)) {
      polygonCoords.push(polygonCoords[0]);
    }
    
    // Convert to format expected by h3.polygonToCells
    // H3 expects an array of [lat, lng] coordinates
    const polygon = polygonCoords.map(point => [point.lat, point.lng]);
    console.log("Using polygon format:", JSON.stringify(polygon));
    
    // Use the h3.polygonToCells function (renamed from polyfill in v4)
    const hexagons = h3.polygonToCells(polygon, resolution);
    console.log("Generated hexagons:", hexagons);
    return hexagons;
  } catch (error) {
    console.error("Error generating H3 hexagons:", error);
    console.log("Error details - Resolution:", resolution);
    console.log("Error details - Coordinates:", JSON.stringify(coordinates));
    
    // Fallback approach: generate hexagons for each point in the polygon
    // This is less accurate but can provide some results if the polygon approach fails
    console.log("Attempting fallback approach with individual points...");
    try {
      const hexSet = new Set();
      polygonCoords.forEach(point => {
        const hexIndex = h3.latLngToCell(point.lat, point.lng, resolution);
        hexSet.add(hexIndex);
      });
      const hexagons = Array.from(hexSet);
      console.log("Generated fallback hexagons:", hexagons);
      return hexagons;
    } catch (fallbackError) {
      console.error("Fallback approach also failed:", fallbackError);
      return [];
    }
  }
}

function updateH3GridInfo(hexagons, resolution) {
  console.log("Updating H3 grid info with:", hexagons.length, "hexagons at resolution", resolution);
  
  // Create JSON representation
  const h3JSON = {
    type: "h3_grid",
    resolution: resolution,
    hexagons: hexagons
  };
  
  // Build Python list of hexagons
  const pythonHexagons = hexagons.map(hex => `    "${hex}"`).join(',\n');
  const pythonOutput = `h3_hexagons = [\n${pythonHexagons}\n]`;
  
  // Get table and column names from inputs or use defaults
  const tableName = tableNameInput?.value || 'my_table';
  const hexIdColumn = hexIdColumnInput?.value || 'h3_id';
  
  // Build SQL IN clause with all values in a single query (no batching)
  const hexValues = hexagons.map(h => `'${h}'`).join(',\n    ');
  
  const sqlOutput = `-- H3 Query
SELECT *
FROM ${tableName}
WHERE ${hexIdColumn} IN (
    ${hexValues}
);`;
  
  infoDiv.innerHTML = `
    <h3>H3 Hexagonal Grid:</h3>
    <p>Resolution: ${resolution}</p>
    <p>Number of hexagons: ${hexagons.length}</p>
    
    <div class="output-section">
      <h4>JSON</h4>
      <div class="scrollable-output">
        <pre id="jsonOutput">${JSON.stringify(h3JSON, null, 2)}</pre>
      </div>
      <button onclick="copyJson()">Copy JSON</button>
    </div>
    
    <div class="output-section">
      <h4>Python</h4>
      <div class="scrollable-output">
        <pre id="pythonOutput">${pythonOutput}</pre>
      </div>
      <button onclick="copyPython()">Copy Python</button>
    </div>
    
    <div class="output-section">
      <h4>SQL Query</h4>
      <div class="sql-input-controls">
        <div class="input-group">
          <label for="tableName">Table name:</label>
          <input type="text" id="tableName" value="${tableName}" placeholder="my_table">
        </div>
        <div class="input-group">
          <label for="hexIdColumn">H3 ID column:</label>
          <input type="text" id="hexIdColumn" value="${hexIdColumn}" placeholder="h3_id">
        </div>
        <button onclick="updateSqlOutput()" class="update-sql-btn">Update SQL</button>
      </div>
      <div class="scrollable-output">
        <pre id="sqlOutput">${sqlOutput}</pre>
      </div>
      <button onclick="copySql()">Copy SQL</button>
    </div>
  `;
}

function updateRectangleGridInfo(boxes) {
  var boundingBoxJSON = {
    type: "grid_boxes",
    grid_size: parseFloat(gridSizeSlider.value),
    boxes: boxes
  };
  
  // Build Python list of boxes
  var pythonBoxes = boxes.map(box => 
    `    {
        "north_west": {"lat": ${box.north_west.lat.toFixed(5)}, "lng": ${box.north_west.lng.toFixed(5)}},
        "north_east": {"lat": ${box.north_east.lat.toFixed(5)}, "lng": ${box.north_east.lng.toFixed(5)}},
        "south_east": {"lat": ${box.south_east.lat.toFixed(5)}, "lng": ${box.south_east.lng.toFixed(5)}},
        "south_west": {"lat": ${box.south_west.lat.toFixed(5)}, "lng": ${box.south_west.lng.toFixed(5)}}
    }`
  ).join(',\n');
  
  var pythonOutput = `grid_boxes = [\n${pythonBoxes}\n]`;
  
  // Get table and column names from inputs or use defaults
  const tableName = tableNameInput?.value || 'my_table';
  const latColumn = latColumnInput?.value || 'latitude';
  const lngColumn = lngColumnInput?.value || 'longitude';
  
  // Build SQL for rectangular grid in a single query (no batching)
  let sqlOutput = `-- Rectangle Grid Query\nSELECT *\nFROM ${tableName}\nWHERE\n`;
  
  boxes.forEach((box, index) => {
    sqlOutput += `    (${latColumn} >= ${box.south_west.lat.toFixed(6)} AND ${latColumn} <= ${box.north_east.lat.toFixed(6)} AND\n     ${lngColumn} >= ${box.south_west.lng.toFixed(6)} AND ${lngColumn} <= ${box.north_east.lng.toFixed(6)})`;
    
    if (index < boxes.length - 1) {
      sqlOutput += ' OR\n';
    }
  });
  
  sqlOutput += ';';
  
  infoDiv.innerHTML = `
    <h3>Rectangular Grid:</h3>
    <p>Grid size: ${gridSizeSlider.value}°</p>
    <p>Number of boxes: ${boxes.length}</p>
    
    <div class="output-section">
      <h4>JSON</h4>
      <div class="scrollable-output">
        <pre id="jsonOutput">${JSON.stringify(boundingBoxJSON, null, 2)}</pre>
      </div>
      <button onclick="copyJson()">Copy JSON</button>
    </div>
    
    <div class="output-section">
      <h4>Python</h4>
      <div class="scrollable-output">
        <pre id="pythonOutput">${pythonOutput}</pre>
      </div>
      <button onclick="copyPython()">Copy Python</button>
    </div>
    
    <div class="output-section">
      <h4>SQL Query</h4>
      <div class="sql-input-controls">
        <div class="input-group">
          <label for="tableName">Table name:</label>
          <input type="text" id="tableName" value="${tableName}" placeholder="my_table">
        </div>
        <div class="input-group">
          <label for="latColumn">Latitude column:</label>
          <input type="text" id="latColumn" value="${latColumn}" placeholder="latitude">
        </div>
        <div class="input-group">
          <label for="lngColumn">Longitude column:</label>
          <input type="text" id="lngColumn" value="${lngColumn}" placeholder="longitude">
        </div>
        <button onclick="updateSqlOutput()" class="update-sql-btn">Update SQL</button>
      </div>
      <div class="scrollable-output">
        <pre id="sqlOutput">${sqlOutput}</pre>
      </div>
      <button onclick="copySql()">Copy SQL</button>
    </div>
  `;
}

function generateBoundingBoxes(coordinates, gridSize = 0.5) {
  // Find the overall bounds of the polygon
  let bounds = findPolygonBounds(coordinates);
  
  // Create grid cells
  let boxes = [];
  for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
    for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
      let box = createBox(lat, lng, gridSize);
      
      // Check if box intersects with polygon
      if (doesBoxIntersectPolygon(box, coordinates)) {
        boxes.push(box);
      }
    }
  }
  
  return boxes;
}

function findPolygonBounds(coordinates) {
  return {
    minLat: Math.min(...coordinates.map(c => c.lat)),
    maxLat: Math.max(...coordinates.map(c => c.lat)),
    minLng: Math.min(...coordinates.map(c => c.lng)),
    maxLng: Math.max(...coordinates.map(c => c.lng))
  };
}

function createBox(lat, lng, gridSize) {
  return {
    north_west: { lat: lat + gridSize, lng: lng },
    north_east: { lat: lat + gridSize, lng: lng + gridSize },
    south_east: { lat: lat, lng: lng + gridSize },
    south_west: { lat: lat, lng: lng }
  };
}

function doesBoxIntersectPolygon(box, polygon) {
  // Create box edges
  const boxEdges = [
    [box.north_west, box.north_east],
    [box.north_east, box.south_east],
    [box.south_east, box.south_west],
    [box.south_west, box.north_west]
  ];
  
  // Check if any polygon point is inside the box
  for (let point of polygon) {
    if (isPointInBox(point, box)) {
      return true;
    }
  }
  
  // Check if any polygon edge intersects with box edges
  for (let i = 0; i < polygon.length; i++) {
    let j = (i + 1) % polygon.length;
    let polygonEdge = [polygon[i], polygon[j]];
    
    for (let boxEdge of boxEdges) {
      if (doLineSegmentsIntersect(polygonEdge[0], polygonEdge[1], boxEdge[0], boxEdge[1])) {
        return true;
      }
    }
  }
  
  // Check if box is completely inside polygon
  let boxCenter = {
    lat: (box.north_west.lat + box.south_east.lat) / 2,
    lng: (box.north_west.lng + box.south_east.lng) / 2
  };
  return isPointInPolygon(boxCenter, polygon);
}

function isPointInBox(point, box) {
  return point.lat >= box.south_west.lat && 
         point.lat <= box.north_west.lat && 
         point.lng >= box.south_west.lng && 
         point.lng <= box.south_east.lng;
}

function doLineSegmentsIntersect(p1, p2, p3, p4) {
  const ccw = (p1, p2, p3) => {
    return (p3.lat - p1.lat) * (p2.lng - p1.lng) > 
           (p2.lat - p1.lat) * (p3.lng - p1.lng);
  };
  
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && 
         ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lng, yi = polygon[i].lat;
    let xj = polygon[j].lng, yj = polygon[j].lat;
    
    let intersect = ((yi > point.lat) != (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Handling rectangle creation and display
function processBoundingBox(layer) {
  const bounds = layer.getBounds();
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  
  // Normalize longitude values to be within -180 to 180
  const neLng = ((northEast.lng + 180) % 360) - 180;
  const swLng = ((southWest.lng + 180) % 360) - 180;
  
  // Create corner points with normalized longitudes
  const northWest = L.latLng(northEast.lat, swLng);
  const southEast = L.latLng(southWest.lat, neLng);
  
  const boundingBoxJSON = createBoundingBoxJSON(northWest, northEast, southEast, southWest, neLng, swLng);
  const pythonOutput = createPythonOutput(northWest, northEast, southEast, southWest, neLng, swLng);
  
  // Get table and column names from inputs or use defaults
  const tableName = document.getElementById('tableName')?.value || 'my_table';
  const latColumn = document.getElementById('latColumn')?.value || 'latitude';
  const lngColumn = document.getElementById('lngColumn')?.value || 'longitude';
  
  // Create SQL for the bounding box
  const sqlOutput = `-- Bounding Box Query
SELECT *
FROM ${tableName}
WHERE ${latColumn} >= ${southWest.lat.toFixed(6)}
  AND ${latColumn} <= ${northEast.lat.toFixed(6)}
  AND ${lngColumn} >= ${swLng.toFixed(6)}
  AND ${lngColumn} <= ${neLng.toFixed(6)};`;
  
  infoDiv.innerHTML = `
    <h3>Bounding Box Coordinates:</h3>
    <p><strong>North-West:</strong> ${northWest.lat.toFixed(5)}, ${northWest.lng.toFixed(5)}</p>
    <p><strong>North-East:</strong> ${northEast.lat.toFixed(5)}, ${neLng.toFixed(5)}</p>
    <p><strong>South-East:</strong> ${southEast.lat.toFixed(5)}, ${southEast.lng.toFixed(5)}</p>
    <p><strong>South-West:</strong> ${southWest.lat.toFixed(5)}, ${swLng.toFixed(5)}</p>
    
    <div class="output-section">
      <h4>JSON</h4>
      <div class="scrollable-output">
        <pre id="jsonOutput">${JSON.stringify(boundingBoxJSON, null, 2)}</pre>
      </div>
      <button onclick="copyJson()">Copy JSON</button>
    </div>
    
    <div class="output-section">
      <h4>Python</h4>
      <div class="scrollable-output">
        <pre id="pythonOutput">${pythonOutput}</pre>
      </div>
      <button onclick="copyPython()">Copy Python</button>
    </div>
    
    <div class="output-section">
      <h4>SQL Query</h4>
      <div class="sql-input-controls">
        <div class="input-group">
          <label for="tableName">Table name:</label>
          <input type="text" id="tableName" value="${tableName}" placeholder="my_table">
        </div>
        <div class="input-group">
          <label for="latColumn">Latitude column:</label>
          <input type="text" id="latColumn" value="${latColumn}" placeholder="latitude">
        </div>
        <div class="input-group">
          <label for="lngColumn">Longitude column:</label>
          <input type="text" id="lngColumn" value="${lngColumn}" placeholder="longitude">
        </div>
        <button onclick="updateSqlOutput()" class="update-sql-btn">Update SQL</button>
      </div>
      <div class="scrollable-output">
        <pre id="sqlOutput">${sqlOutput}</pre>
      </div>
      <button onclick="copySql()">Copy SQL</button>
    </div>
  `;
}

function createBoundingBoxJSON(northWest, northEast, southEast, southWest, neLng, swLng) {
  return {
    north_west: {
      lat: northWest.lat.toFixed(5),
      lng: northWest.lng.toFixed(5)
    },
    north_east: {
      lat: northEast.lat.toFixed(5),
      lng: neLng.toFixed(5)
    },
    south_east: {
      lat: southEast.lat.toFixed(5),
      lng: southEast.lng.toFixed(5)
    },
    south_west: {
      lat: southWest.lat.toFixed(5),
      lng: swLng.toFixed(5)
    }
  };
}

function createPythonOutput(northWest, northEast, southEast, southWest, neLng, swLng) {
  return "bounding_box = {\n" +
    `    "north_west": {"lat": ${northWest.lat.toFixed(5)}, "lng": ${northWest.lng.toFixed(5)}},\n` +
    `    "north_east": {"lat": ${northEast.lat.toFixed(5)}, "lng": ${neLng.toFixed(5)}},\n` +
    `    "south_east": {"lat": ${southEast.lat.toFixed(5)}, "lng": ${southEast.lng.toFixed(5)}},\n` +
    `    "south_west": {"lat": ${southWest.lat.toFixed(5)}, "lng": ${swLng.toFixed(5)}}\n` +
    "}";
}

// Listen for the creation of a new shape
map.on(L.Draw.Event.CREATED, function (e) {
  var layer = e.layer;
  var shape = e.layerType;
  
  // Clear any existing drawn shapes
  drawnItems.clearLayers();
  drawnItems.addLayer(layer);
  
  if (shape === 'polygon') {
    enableGridControls();
    redrawGrid(layer);
  }
  else if (shape === 'rectangle') {
    disableGridControls();
    processBoundingBox(layer);
  }
});

// Copy functions
function copyJson() {
  copyToClipboard("jsonOutput", "Copied JSON to clipboard!");
}

function copyPython() {
  copyToClipboard("pythonOutput", "Copied Python snippet to clipboard!");
}

function copySql() {
  copyToClipboard("sqlOutput", "Copied SQL to clipboard!");
}

function copyToClipboard(elementId, successMessage) {
  var text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert(successMessage);
  });
}

// Grid control visibility functions
function disableGridControls() {
  gridSizeSlider.disabled = true;
  gridSizeManual.disabled = true;
  tileTypeSelector.disabled = true;
  document.getElementById('h3Resolution').disabled = true;
  document.querySelector('.grid-control').style.opacity = '0.5';
  gridWarningDiv.textContent = 'Grid controls only available for polygons';
}

function enableGridControls() {
  gridSizeSlider.disabled = false;
  gridSizeManual.disabled = false;
  tileTypeSelector.disabled = false;
  document.getElementById('h3Resolution').disabled = false;
  document.querySelector('.grid-control').style.opacity = '1';
  gridWarningDiv.textContent = 'Draw a polygon to see box count';
  updateTileControls();
}

// Modal initialization
document.addEventListener('DOMContentLoaded', function() {
  initializeHelpModal();
  positionHelpButton();
  disableGridControls();
  updateTileControls();
  
  // Check if H3 is loaded using the approach from the working example
  if (typeof h3 === 'undefined') {
    console.error("H3 library is not loaded! Make sure the script tag is included correctly.");
    alert("H3 library is not loaded. Some features may not work correctly.");
  } else {
    console.log("H3 library loaded successfully.");
    
    // Test the H3 library with a simple conversion (like in your example)
    try {
      const testIndex = h3.latLngToCell(37.7749, -122.4194, 9);
      console.log("H3 test successful:", testIndex);
    } catch (e) {
      console.error("H3 test failed:", e);
    }
  }
});

function initializeHelpModal() {
  const modal = document.getElementById("helpModal");
  const helpBtn = document.getElementById("helpBtn");
  const closeBtn = document.getElementsByClassName("close")[0];
  
  if (modal && helpBtn && closeBtn) {
    helpBtn.onclick = function() {
      modal.style.display = "block";
    }

    closeBtn.onclick = function() {
      modal.style.display = "none";
    }

    window.addEventListener('click', function(event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    });
  }
}

function positionHelpButton() {
  const zoomOutButton = document.querySelector('.leaflet-control-zoom-out');
  const helpBtn = document.getElementById("helpBtn");
  
  if (zoomOutButton && helpBtn) {
    const zoomRect = zoomOutButton.getBoundingClientRect();
    const zoomBottom = zoomRect.bottom;
    
    helpBtn.style.top = (zoomBottom + 10) + 'px';
    helpBtn.style.left = zoomRect.left + 'px';
  }
}

// Function to find the optimal starting H3 resolution
function findOptimalH3Resolution(coordinates) {
  // Start with the largest hexagons (resolution 0)
  for (let resolution = 0; resolution <= 15; resolution++) {
    try {
      // Try to generate hexagons at this resolution
      const hexagons = generateH3Hexagons(coordinates, resolution);
      
      // If we got at least one hexagon, this is our optimal resolution
      if (hexagons && hexagons.length > 0) {
        console.log(`Found optimal starting resolution: ${resolution} with ${hexagons.length} hexagons`);
        return resolution;
      }
      
      // If we reach resolution 5 and still have no hexagons, something might be wrong
      // with the polygon or coordinates, so we'll stop to prevent excessive processing
      if (resolution >= 5) {
        console.warn("Couldn't find hexagons even at resolution 5, defaulting to resolution 5");
        return 5;
      }
    } catch (error) {
      console.error(`Error finding hexagons at resolution ${resolution}:`, error);
      // Continue to the next resolution
    }
  }
  
  // If we couldn't find any hexagons at any resolution, default to 5
  return 5;
}

// Function to update SQL output when table/column names change
function updateSqlOutput() {
  console.log("updateSqlOutput called");
  
  // Get input values directly without any default fallbacks
  const tableNameElement = document.getElementById('tableName');
  const hexIdColumnElement = document.getElementById('hexIdColumn');
  const latColumnElement = document.getElementById('latColumn');
  const lngColumnElement = document.getElementById('lngColumn');
  
  // Get values directly from the elements
  const currentTableName = tableNameElement ? tableNameElement.value : '';
  const currentHexIdColumn = hexIdColumnElement ? hexIdColumnElement.value : '';
  const currentLatColumn = latColumnElement ? latColumnElement.value : '';
  const currentLngColumn = lngColumnElement ? lngColumnElement.value : '';
  
  console.log("Current values:", {
    tableName: currentTableName,
    hexIdColumn: currentHexIdColumn,
    latColumn: currentLatColumn,
    lngColumn: currentLngColumn
  });
  
  if (drawnItems.getLayers().length > 0) {
    const layer = drawnItems.getLayers()[0];
    const sqlOutputElement = document.getElementById('sqlOutput');
    
    if (!sqlOutputElement) {
      console.error("SQL output element not found");
      return;
    }
    
    // Handle different types of layers
    if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
      // Handle polygon (not a rectangle)
      if (currentTileType === TILE_TYPES.RECTANGLE) {
        // Rectangular grid
        console.log("Regenerating rectangular grid SQL...");
        const coordinates = layer.getLatLngs()[0];
        const gridSize = parseFloat(gridSizeManual.value);
        const boxes = generateBoundingBoxes(coordinates, gridSize);
        
        // Generate SQL
        let sql = `-- Rectangle Grid Query\nSELECT *\nFROM ${currentTableName}\nWHERE\n`;
        
        boxes.forEach((box, index) => {
          sql += `    (${currentLatColumn} >= ${box.south_west.lat.toFixed(6)} AND ${currentLatColumn} <= ${box.north_east.lat.toFixed(6)} AND\n     ${currentLngColumn} >= ${box.south_west.lng.toFixed(6)} AND ${currentLngColumn} <= ${box.north_east.lng.toFixed(6)})`;
          
          if (index < boxes.length - 1) {
            sql += ' OR\n';
          }
        });
        
        sql += ';';
        
        // Update only the SQL output text
        sqlOutputElement.textContent = sql;
        console.log("SQL updated for rectangular grid");
        
      } else {
        // H3 hexagonal grid
        console.log("Regenerating H3 grid SQL...");
        const coordinates = layer.getLatLngs()[0];
        const resolution = parseInt(document.getElementById('h3Resolution').value);
        const hexagons = generateH3Hexagons(coordinates, resolution);
        
        // Generate SQL
        const hexValues = hexagons.map(h => `'${h}'`).join(',\n    ');
        const sql = `-- H3 Query
SELECT *
FROM ${currentTableName}
WHERE ${currentHexIdColumn} IN (
    ${hexValues}
);`;
        
        // Update only the SQL output text
        sqlOutputElement.textContent = sql;
        console.log("SQL updated for H3 grid");
      }
    } 
    else if (layer instanceof L.Rectangle) {
      // Handle regular bounding box (rectangle)
      console.log("Regenerating bounding box SQL...");
      
      const bounds = layer.getBounds();
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
      
      // Normalize longitude values
      const neLng = ((northEast.lng + 180) % 360) - 180;
      const swLng = ((southWest.lng + 180) % 360) - 180;
      
      // Generate SQL
      const sql = `-- Bounding Box Query
SELECT *
FROM ${currentTableName}
WHERE ${currentLatColumn} >= ${southWest.lat.toFixed(6)}
  AND ${currentLatColumn} <= ${northEast.lat.toFixed(6)}
  AND ${currentLngColumn} >= ${swLng.toFixed(6)}
  AND ${currentLngColumn} <= ${neLng.toFixed(6)};`;
      
      // Update only the SQL output text
      sqlOutputElement.textContent = sql;
      console.log("SQL updated for bounding box");
    } 
    else {
      console.log("Not updating SQL - unknown layer type");
    }
  } else {
    console.log("No layers found to update");
  }
}

// Add a listener to update the cached references to input elements
document.addEventListener('DOMContentLoaded', function() {
  console.log("Setting up input references");
  // Make sure our references are updated when the DOM changes
  function updateInputReferences() {
    tableNameInput = document.getElementById('tableName');
    hexIdColumnInput = document.getElementById('hexIdColumn');
    latColumnInput = document.getElementById('latColumn');
    lngColumnInput = document.getElementById('lngColumn');
    console.log("Input references updated:", {
      tableNameInput, hexIdColumnInput, latColumnInput, lngColumnInput
    });
  }
  
  // Call initially
  updateInputReferences();
  
  // Set up a mutation observer to watch for DOM changes
  const observer = new MutationObserver(updateInputReferences);
  observer.observe(document.getElementById('info') || document.body, { 
    childList: true, 
    subtree: true 
  });
});

// Add CSS to make the SQL inputs look good
const styleElement = document.createElement('style');
styleElement.textContent = `
.sql-input-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-group label {
  font-size: 12px;
  margin-bottom: 4px;
}

.input-group input {
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.update-sql-btn {
  padding: 5px 10px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  align-self: flex-end;
  margin-top: 20px;
}

.update-sql-btn:hover {
  background-color: #45a049;
}
`;
document.head.appendChild(styleElement);

