/* global AFRAME, THREE */
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

var d3 = require('d3');

/**
 * Graph component for A-Frame.
 */
AFRAME.registerComponent('graph', {
  schema: {
    csv: {
      type: 'string'
    },
    type: {
      type: 'string',
      default: 'scatter'
    },
    id: {
      type: 'int',
      default: '0'
    },
    width: {
      type: 'number',
      default: 1
    },
    height: {
      type: 'number',
      default: 1
    },
    depth: {
      type: 'number',
      default: 1
    }
  },

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    // Entity data
    var el = this.el;
    var object3D = el.object3D;
    var data = this.data;

    var width = data.width;
    var height = data.height;
    var depth = data.depth;

    // These will be used to set the range of the axes' scales
    var xRange = [0, width];
    var yRange = [0, height];
    var zRange = [0, -depth];

    // Create graphBox Object3D to hold grids and axis labels
    var graphBox = new THREE.Object3D();
    graphBox.name = 'graphBox';

    // Create graphing area out of three textured planes
    var grid = gridMaker(width, height, depth);
    graphBox.add(grid);

    // Label using sprites
    // using the same padding for all axes does not work very well...magic numbers for now
    var xLabel = spriteMaker('x');
    xLabel.position.z = (depth / 2) + 0.01;
    xLabel.position.y = -0.1;
    graphBox.add(xLabel);

    var yLabel = spriteMaker('y');
    yLabel.position.x = (width / 2) + 0.15;
    yLabel.position.z = -(depth / 2) - 0.1;
    yLabel.position.y = (height / 2);
    graphBox.add(yLabel);

    var zLabel = spriteMaker('z');
    zLabel.position.x = (width / 2) + 0.15;
    zLabel.position.y = -0.1;
    graphBox.add(zLabel);

    // Add completed graphBox to element's Object3D
    object3D.add(graphBox);

    /**
     * Create origin point.
     * This gives a solid reference point for scaling data.
     * It is positioned at the vertex of the left grid and bottom grid (towards the front).
     */
    var originPointPosition = (-width / 2) + ' 0 ' + (depth / 2);
    var originPointID = 'originPoint' + data.id;

    d3.select(el).append('a-entity')
                 .attr('id', originPointID)
                 .attr('position', originPointPosition);
                 /** DEBUG
                  * .attr('geometry', "primitive: sphere; radius: 0.021")
                  * .attr('material', "color: green");
                  */

    if (data.csv) {
      /* Plot data from CSV */

      var originPoint = d3.select('#originPoint' + data.id);

      // Convert CSV data from string to number
      d3.csv(data.csv, function (data) {
        data.forEach(function (d) {
          d.x = +d.x;
          d.y = +d.y;
          d.z = +d.z;
        });

        plotData(data);
      });

      var plotData = function (data) {
        // Scale x, y, and z values
        // d3.extent is just short hand for d3.max and d3.min.
        var xExtent = d3.extent(data, function (d) { return d.x; });
        var xScale = d3.scale.linear()
                       .domain(xExtent)
                       .range([xRange[0], xRange[1]]);

        var yExtent = d3.extent(data, function (d) { return d.y; });
        var yScale = d3.scale.linear()
                       .domain(yExtent)
                       .range([yRange[0], yRange[1]]);

        var zExtent = d3.extent(data, function (d) { return d.z; });
        var zScale = d3.scale.linear()
                       .domain(zExtent)
                       .range([zRange[0], zRange[1]]);

        // Append data to graph and attach event listeners
        originPoint.selectAll('a-sphere')
                   .data(data)
                   .enter()
                   .append('a-sphere')
                   .attr('radius', 0.02)
                   .attr('color', '#D50000')
                   .attr('position', function (d) {
                     return xScale(d.x) + ' ' + yScale(d.y) + ' ' + zScale(d.z);
                   })
                   .on('mouseenter', mouseEnter);

        /**
         * Event listener adds and removes data labels.
         * "this" refers to sphere element of a given data point.
         */
        function mouseEnter () {
          // Get height of graphBox (needed to scale label position)
          var graphBoxEl = this.parentElement.parentElement;
          var graphBoxData = graphBoxEl.components.graph.data;
          var graphBoxHeight = graphBoxData.height;

          // Look for an existing label
          var originPointObject3D = this.parentElement.object3D;
          var oldLabel = originPointObject3D.getObjectByName('tempDataLabel');

          // If there is no existing label, make one
          if (oldLabel === undefined) {
            labelMaker(this, graphBoxHeight);
          } else {
            // Remove old label
            var labeledData = oldLabel.parent;
            labeledData.remove(oldLabel);
            // Remove highlight
            var labeledDataEl = labeledData.el;
            labeledDataEl.setAttribute('color', 'red');
            labeledDataEl.setAttribute('radius', 0.02);
            // Create new one
            labelMaker(this, graphBoxHeight);
          }
        }
      };
    }
  }
});

/* HELPER FUNCTIONS */

/**
 * planeMaker() creates a plane given width and height (kind of).
 *  It is used by gridMaker().
 */
function planeMaker (horizontal, vertical) {
  // Controls texture repeat for U and V
  var uHorizontal = horizontal * 4;
  var vVertical = vertical * 4;

  // Load a texture, set wrap mode to repeat
  var texture = new THREE.TextureLoader().load('/assets/grid-textures/grid3.png');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // should be: texture.anisotropy = renderer.getMaxAnisotropy();
  // but I can't figure out how to get this working
  texture.anisotropy = 16;
  texture.repeat.set(uHorizontal, vVertical);

  // Create material and geometry
  var material = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
  var geometry = new THREE.PlaneGeometry(horizontal, vertical);

  return new THREE.Mesh(geometry, material);
}

/**
 * gridMaker() creates a graphing box given width, height, and depth.
 * The textures are also scaled to these dimensions.
 *
 * There are many ways this function could be improved or done differently
 * e.g. buffer geometry, merge geometry, better reuse of material/geometry.
 */
function gridMaker (width, height, depth) {
  var grid = new THREE.Object3D();

  // AKA bottom grid
  var xGrid = planeMaker(width, depth);
  xGrid.rotation.x = 90 * (Math.PI / 180);
  grid.add(xGrid);

  // AKA far grid
  var yPlane = planeMaker(width, height);
  yPlane.position.y = (0.5) * height;
  yPlane.position.z = (-0.5) * depth;
  grid.add(yPlane);

  // AKA side grid
  var zPlane = planeMaker(depth, height);
  zPlane.position.x = (-0.5) * width;
  zPlane.position.y = (0.5) * height;
  zPlane.rotation.y = 90 * (Math.PI / 180);
  grid.add(zPlane);

  return grid;
}

/**
 * spriteMaker() creates a THREE.Sprite given some text. Definitely a WIP.
 * Based off the work of Lee Stemkoski and Sue Lockwood.
 * https://bocoup.com/weblog/learning-three-js-with-real-world-challenges-that-have-already-been-solved
 */
function spriteMaker (message) {
  // Create canvas, load font and size
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  canvas.width = 256;
  canvas.height = 256;

  // Scaling text to fit canvas...is tricky
  // http://stackoverflow.com/questions/4114052/best-method-of-scaling-text-to-fill-an-html5-canvas

  // Setup font
  context.font = "50px 'Helvetica'";

  // Measure text width
  var text = context.measureText(message);

  // Calculate position of text
  var x = (canvas.width / 2) - (text.width / 2);
  var y = canvas.height / 2;

  // Draw
  context.fillText(message, x, y);

  // Debug outline (to see canvas size)
  context.fillStyle = 'rgb(200,0,0)';
  context.strokeRect(0, 0, canvas.width, canvas.height);

  // canvas contents will be used for texture
  var texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  var sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.5, 0.5, 0.5);
  return sprite;
}

/**
 * labelMaker() creates a label for a given data point and graph height.
 * Uses spriteMaker().
 * dataEl - A data point's element.
 * graphBoxHeight - The height of the graph.
 */
function labelMaker (dataEl, graphBoxHeight) {
  // Retrieve original data
  var dataValues = dataEl.__data__;

  // Give label object a name so it can be removed later
  var label = new THREE.Object3D();
  label.name = 'tempDataLabel';

  // Create individual x, y, and z labels using original data values
  // round to 1 decimal space (should use d3 format for consistency later)
  var spriteLabelText = '(' + d3.round(dataValues.x, 1) + ',' + d3.round(dataValues.y, 1) + ',' + d3.round(dataValues.z, 1) + ')';
  var spriteLabel = spriteMaker(spriteLabelText);
  label.add(spriteLabel);

  // Position label above graph
  var padding = 0.2;
  var sphereYposition = dataEl.getAttribute('position').y;
  label.position.y = (graphBoxHeight + padding) - sphereYposition;

  // Highlight selected data point
  dataEl.setAttribute('color', 'blue');
  dataEl.setAttribute('radius', 0.03);

  dataEl.object3D.add(label);
}
