if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

/**
 * Graph component for A-Frame.
 */
AFRAME.registerComponent('graph', {
  schema: {
    csv: {
      type: "string"
    },
    type: {
      type: "string",
      default: "scatter"
    },
    id: {
      type: "int",
      default: "0"
    },
    width: {
      type: "number",
      default: 1
    },
    height: {
      type: "number",
      default: 1
    },
    depth: {
      type: "number",
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
    var xRange = [0, width]
    var yRange = [0, height]
    var zRange = [0, -depth]

    // Create graphbox Object3D to hold grids and axis labels
    var graphbox = new THREE.Object3D();

    // Create graphing area out of three textured planes
    var grid = gridMaker(width, height, depth);
    graphbox.add( grid );

    // Label using sprites
    // using the same padding for all axes does not work very well...magic numbers for now
    var xLabel = spriteMaker("x");
    xLabel.position.z = (depth / 2) + 0.01;
    xLabel.position.y = -0.1;
    graphbox.add( xLabel );

    var yLabel = spriteMaker("y");
    yLabel.position.x = (width / 2) + 0.15;
    yLabel.position.z = -(depth / 2) - 0.1;
    yLabel.position.y = (height / 2);
    graphbox.add( yLabel );

    var zLabel = spriteMaker("z");
    zLabel.position.x = (width / 2) + 0.15;
    zLabel.position.y = -0.1;
    graphbox.add( zLabel );

    // Add completed graphbox to element's Object3D
    object3D.add( graphbox );

    /**
     * Create origin point.
     * This gives a solid reference point for scaling data.
     * It is positioned at the vertex of the left grid and bottom grid (towards the front).
     */
    var originPointPosition = (-width / 2) + " 0 " + (width / 2);
    var originPointID = "originPoint" + data.id;

    d3.select(el).append("a-entity")
                 .attr("id", originPointID)
                 .attr("position", originPointPosition);
                 // DEBUG
                 //.attr("geometry", "primitive: sphere; radius: 0.021")
                 //.attr("material", "color: green");


    /* Plot data from CSV */

    if ( data.csv ) {

      var originPoint = d3.select("#originPoint" + data.id);

      // Convert CSV data from string to number
      d3.csv(data.csv, function(data) {
        data.forEach(function(d) {
          d.x = +d.x;
          d.y = +d.y;
          d.z = +d.z;
        });

        plotData(data)
      });

      function plotData(data) {

        // Scale x, y, and z values
        // d3.extent is just short hand for d3.max and d3.min.
        var xExtent = d3.extent(data, function(d) { return d.x });
        var xScale = d3.scale.linear()
                       .domain(xExtent)
                       .range([xRange[0], xRange[1]]);

        var yExtent = d3.extent(data, function(d) { return d.y });
        var yScale = d3.scale.linear()
                       .domain(yExtent)
                       .range([yRange[0], yRange[1]]);

        var zExtent = d3.extent(data, function(d) { return d.z });
        var zScale = d3.scale.linear()
                       .domain(zExtent)
                       .range([zRange[0], zRange[1]]);

        // Append data to graph and attach event listeners
        originPoint.selectAll("a-sphere")
                   .data(data)
                   .enter()
                   .append("a-sphere")
                   .attr("radius", 0.02)
                   .attr("color", "#D50000")
                   .attr("position", function(d) {
                     return xScale(d.x) + " " + yScale(d.y) + " " + zScale(d.z);
                   })
                   .on("mouseenter", mouseEnter)
                   .on("mouseleave", mouseLeave);

        /**
         * Event listeners add and remove data labels
         * Note: "this" refers to sphere element of a given data point.
         */
        function mouseEnter() {

          // Retrieve original data
          var dataValues = this.__data__;

          // Give label object a name so it can be removed later
          var label = new THREE.Object3D();
          label.name = "tempDataLabel";

          // Create individual x, y, and z labels using original data values
          // round to 1 decimal space (should use d3 format for consistency later)
          var xLabel = spriteMaker( d3.round(dataValues.x, 1) + "," );
          label.add( xLabel );

          var yLabel = spriteMaker( d3.round(dataValues.y, 1) + "," );
          yLabel.position.x = 0.15;
          label.add( yLabel );

          var zLabel = spriteMaker( d3.round(dataValues.z, 2) );
          zLabel.position.x = 0.30;
          label.add( zLabel );

          // Position label above and behind data point
          label.position.y = 0.1;
          label.position.z = -0.1;

          this.object3D.add( label );
        }

        function mouseLeave() {

          var label = this.object3D.getObjectByName("tempDataLabel");
          this.object3D.remove( label );
        }
      }
    }
  },
});


/* HELPER FUNCTIONS */

/**
 * planeMaker() creates a plane given width and height (kind of).
 *  It is a helper function for gridMaker().
 */
function planeMaker(horizontal, vertical) {
  // Controls the number of boxes in the grid horizontally and vertically
  var squaresHorizontal = horizontal * 4;
  var squaresVertical = vertical * 4;

  // Load a texture, set wrap mode to repeat
  var texture = new THREE.TextureLoader().load( "/assets/grid-textures/grid3.png" );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // should be: texture.anisotropy = renderer.getMaxAnisotropy();
  // but I can't figure out how to get this working
  texture.anisotropy = 16;
  texture.repeat.set( squaresHorizontal, squaresVertical );

  // Create material and geometry
  var material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );
  var geometry = new THREE.PlaneGeometry( horizontal, vertical );

  return new THREE.Mesh( geometry, material );
}

/**
 * gridMaker() creates a graphing box given width, height, and depth.
 * The number of squares per grid is scaled to these dimensions.
 *
 * There are many ways this function could be improved or done differently
 * e.g. buffer geometry, merge geometry, better reuse of material/geometry.
 */
function gridMaker(width, height, depth) {

  var grid = new THREE.Object3D();

  // AKA bottom grid
  var xGrid = planeMaker( width, depth );
  xGrid.rotation.x = 90 * (Math.PI / 180);
  grid.add( xGrid );

  // AKA far grid
  var yPlane = planeMaker( width, height );
  yPlane.position.y = (0.5) * height;
  yPlane.position.z = (-0.5) * depth;
  grid.add( yPlane );

  // AKA side grid
  var zPlane = planeMaker( depth, height )
  zPlane.position.x = (-0.5) * width;
  zPlane.position.y = (0.5) * height;
  zPlane.rotation.y = 90 * (Math.PI / 180);
  grid.add( zPlane );

  return grid;
}

/**
 * spriteMaker() creates a THREE.Sprite given some text. Definitely a WIP.
 * Based off the work of Lee Stemkoski and Sue Lockwood.
 * https://bocoup.com/weblog/learning-three-js-with-real-world-challenges-that-have-already-been-solved
 */
function spriteMaker(message) {

  // Create canvas, load font and size
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  canvas.width = 64;
  canvas.height = 64;

  // Scaling text to fit canvas...is tricky
  // http://stackoverflow.com/questions/4114052/best-method-of-scaling-text-to-fill-an-html5-canvas
  context.font = "20px 'Helvetica'";
  var metrics = context.measureText(message);
  var textWidth = metrics.width;

  var scalex = (canvas.width / textWidth);
  var scaley = (canvas.height / 20);

  var ypos = (canvas.height / (scaley * 1.25));

  context.scale(scalex, scaley);
  context.fillText(message, 0, ypos);

  // canvas contents will be used for texture
  var texture = new THREE.Texture(canvas)
      texture.minFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  var sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.set(0.125,0.125,0.125);
  return sprite;
}
