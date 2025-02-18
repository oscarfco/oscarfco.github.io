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
  allowIntersection: false, // Restricts shapes to simple polygons
  drawError: {
    color: '#e1e100',
    message: '<strong>Error:</strong> shape edges cannot cross!'
  },
  guidelineDistance: 10,
  showLength: true,
  metric: true
};

// When the "Draw Polygon" button is clicked
document.getElementById('polygonBtn').addEventListener('click', function() {
  new L.Draw.Polygon(map, polygonDrawOptions).enable();
});

// When the "Capture Bounding Box" button is clicked
document.getElementById('captureBtn').addEventListener('click', function() {
  new L.Draw.Rectangle(map).enable();
});

// Add grid size control
const gridSizeSlider = document.getElementById('gridSize');
const gridSizeManual = document.getElementById('gridSizeManual');

function calculateNumberOfBoxes(coordinates, gridSize) {
    const minLat = Math.min(...coordinates.map(c => c.lat));
    const maxLat = Math.max(...coordinates.map(c => c.lat));
    const minLng = Math.min(...coordinates.map(c => c.lng));
    const maxLng = Math.max(...coordinates.map(c => c.lng));
    
    const latBoxes = Math.ceil((maxLat - minLat) / gridSize);
    const lngBoxes = Math.ceil((maxLng - minLng) / gridSize);
    
    return latBoxes * lngBoxes;
}

function updateGridSize(value, source) {
    const BOX_LIMIT = 1500;
    
    if (drawnItems.getLayers().length > 0) {
        const layer = drawnItems.getLayers()[0];
        if (layer instanceof L.Polygon) {
            const coordinates = layer.getLatLngs()[0];
            const boxes = generateBoundingBoxes(coordinates, value);
            const numBoxes = boxes.length;
            
            const warningDiv = document.getElementById('gridWarning');
            
            if (numBoxes > BOX_LIMIT) {
                warningDiv.textContent = `Grid size too small! Would create ${numBoxes} boxes. Maximum is ${BOX_LIMIT} boxes.`;
                warningDiv.style.color = 'red';
                return false;
            } else {
                warningDiv.textContent = `Current number of boxes: ${numBoxes}`;
                warningDiv.style.color = 'black';
                
                // Update both inputs
                gridSizeSlider.value = value;
                gridSizeManual.value = value;
                
                redrawGrid(layer);
                return true;
            }
        }
    }
    
    // If no polygon drawn, just update the values
    gridSizeSlider.value = value;
    gridSizeManual.value = value;
    return true;
}

// Update slider event listener
gridSizeSlider.addEventListener('input', function(e) {
    const value = parseFloat(e.target.value);
    if (!updateGridSize(value, 'slider')) {
        // If update failed, revert to previous valid value
        e.target.value = gridSizeManual.value;
    }
});

// Update manual input event listener
gridSizeManual.addEventListener('input', function(e) {
    let value = parseFloat(e.target.value);
    value = Math.min(Math.max(value, 0.01), 1);
    
    if (!updateGridSize(value, 'manual')) {
        // If update failed, revert to previous valid value
        e.target.value = gridSizeSlider.value;
    }
});

function redrawGrid(layer) {
  // Clear existing grid
  drawnItems.clearLayers();
  drawnItems.addLayer(layer);
  
  // Get the coordinates and redraw grid
  const coordinates = layer.getLatLngs()[0];
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
  updateInfo(boxes);
}

function updateInfo(boxes) {
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
  
  var pythonOutput = 
    `grid_boxes = [\n${pythonBoxes}\n]`;
  
  var infoDiv = document.getElementById('info');
  infoDiv.innerHTML = `
    <h3>Grid Approximation:</h3>
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
  `;
}

function generateBoundingBoxes(coordinates, gridSize = 0.5) {
  // Find the overall bounds of the polygon
  let minLat = Math.min(...coordinates.map(c => c.lat));
  let maxLat = Math.max(...coordinates.map(c => c.lat));
  let minLng = Math.min(...coordinates.map(c => c.lng));
  let maxLng = Math.max(...coordinates.map(c => c.lng));
  
  // Create grid cells
  let boxes = [];
  for (let lat = minLat; lat < maxLat; lat += gridSize) {
    for (let lng = minLng; lng < maxLng; lng += gridSize) {
      let box = {
        north_west: { lat: lat + gridSize, lng: lng },
        north_east: { lat: lat + gridSize, lng: lng + gridSize },
        south_east: { lat: lat, lng: lng + gridSize },
        south_west: { lat: lat, lng: lng }
      };
      
      // Check if box intersects with polygon
      if (doesBoxIntersectPolygon(box, coordinates)) {
        boxes.push(box);
      }
    }
  }
  
  return boxes;
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
  // Calculate line intersection using vector cross product
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

// Listen for the creation of a new shape
map.on(L.Draw.Event.CREATED, function (e) {
  var layer = e.layer;
  var shape = e.layerType;
  
  // Clear any existing drawn shapes
  drawnItems.clearLayers();
  drawnItems.addLayer(layer);
  
  if (shape === 'polygon') {
    redrawGrid(layer);
  }
  else if (shape === 'rectangle') {
    // Get the bounds of the rectangle
    var bounds = layer.getBounds();
    var northEast = bounds.getNorthEast();
    var southWest = bounds.getSouthWest();
    var northWest = L.latLng(northEast.lat, southWest.lng);
    var southEast = L.latLng(southWest.lat, northEast.lng);
    
    // Build JSON object
    var boundingBoxJSON = {
      north_west: {
        lat: northWest.lat.toFixed(5),
        lng: northWest.lng.toFixed(5)
      },
      north_east: {
        lat: northEast.lat.toFixed(5),
        lng: northEast.lng.toFixed(5)
      },
      south_east: {
        lat: southEast.lat.toFixed(5),
        lng: southEast.lng.toFixed(5)
      },
      south_west: {
        lat: southWest.lat.toFixed(5),
        lng: southWest.lng.toFixed(5)
      }
    };
    
    // Build Python variables as a string
    var pythonOutput = 
      "bounding_box = {\n" +
      `    "north_west": {"lat": ${northWest.lat.toFixed(5)}, "lng": ${northWest.lng.toFixed(5)}},\n` +
      `    "north_east": {"lat": ${northEast.lat.toFixed(5)}, "lng": ${northEast.lng.toFixed(5)}},\n` +
      `    "south_east": {"lat": ${southEast.lat.toFixed(5)}, "lng": ${southEast.lng.toFixed(5)}},\n` +
      `    "south_west": {"lat": ${southWest.lat.toFixed(5)}, "lng": ${southWest.lng.toFixed(5)}}\n` +
      "}";

    // Update the info div
    var infoDiv = document.getElementById('info');
    infoDiv.innerHTML = `
      <h3>Bounding Box Coordinates:</h3>
      <p><strong>North-West:</strong> ${northWest.lat.toFixed(5)}, ${northWest.lng.toFixed(5)}</p>
      <p><strong>North-East:</strong> ${northEast.lat.toFixed(5)}, ${northEast.lng.toFixed(5)}</p>
      <p><strong>South-East:</strong> ${southEast.lat.toFixed(5)}, ${southEast.lng.toFixed(5)}</p>
      <p><strong>South-West:</strong> ${southWest.lat.toFixed(5)}, ${southWest.lng.toFixed(5)}</p>
      
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
    `;
  }
});

// Copy JSON to clipboard
function copyJson() {
  var jsonText = document.getElementById("jsonOutput").textContent;
  navigator.clipboard.writeText(jsonText).then(() => {
    alert("Copied JSON to clipboard!");
  });
}

// Copy Python snippet to clipboard
function copyPython() {
  var pythonText = document.getElementById("pythonOutput").textContent;
  navigator.clipboard.writeText(pythonText).then(() => {
    alert("Copied Python snippet to clipboard!");
  });
}

// Add copy function for SQL
function copySql() {
  var sqlText = document.getElementById("sqlOutput").textContent;
  navigator.clipboard.writeText(sqlText).then(() => {
    alert("Copied SQL to clipboard!");
  });
}

// Add delete button functionality
document.getElementById('deleteBtn').addEventListener('click', function() {
  // Clear the drawn rectangle
  drawnItems.clearLayers();
  
  // Clear the info div
  document.getElementById('info').innerHTML = '';
});
