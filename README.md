## aframe-graph-component (WIP)

This is a work-in-progress and not yet usable.

An experimental component for graphing in [A-Frame](https://aframe.io). Currently only 3D scatter plots are supported.

### Properties

| Property |         Description         | Default Value |
|:--------:|:---------------------------:|:-------------:|
|    csv   |       Path to CSV data      |      none     |
|   type   |        Type of graph        |    scatter    |
|    id    |         ID of graph         |       0       |
|   width  |  Width of the graphing area |       1       |
|  height  | Height of the graphing area |       1       |
|   depth  |  Depth of the graphing area |       1       |

### Usage

Creating a 3D scatter plot can be as easy as:

```html
<a-entity graph="csv: yourData.csv;"></a-entity>
```

Of course, you can also manually define the dimensions of the graphing area.

### Multiple Graphs

If you want to display more than one graph, a unique numerical id must be specified.

```html
<a-entity graph="csv: yourOtherData.csv; id: 1"></a-entity>
```

This limitation is due to the way data is plotted internally (using D3's "selectAll" method).

### Graph Size and Scaling

By default, graphs are displayed in a box with an edge length of 1 (i.e. the dimensions are 1x1x1). Data is scaled to fit within these bounds using linear scales provided by D3. The domain goes from the minimum value in the dataset to the maximum (internally this is done with D3's extent method).

The range is a bit more complicated. Before data is plotted, an "origin point" is appended to the graph box--it lies at the front-left vertex. Range for each axis is constructed with this point as the origin; for example, xy-values can range from 0 to 1 (spanning the entire front and vertical edges of the graph box). The z-axis is different as it ranges from 0 to -1 (larger z-values are further from the origin point pushing into the box). When width, height, or depth is modified the relevant range maximums are scaled up or down and the graph area is redrawn. The grid texture applied to each side of the graphing area is also adjusted to prevent horizontal or vertical stretching.

### Labeling

The labels used here are THREE.Sprites textured with 2D canvas.

This solution is only half-complete due to problems with the cursor. Mayognaise's wonderful [mouse-cursor component](https://github.com/mayognaise/aframe-mouse-cursor-component) works well for selecting data points with the mouse, but the standard look-cursor is terribly buggy.

Alternative means of handling text were evaluated, but sprites were the only contender I could get working correctly. Text Geometry was a contender, but the look-at component failed to coerce them into looking at the camera. It would be nice if A-Frame introduced a built-in way of dealing with text, perhaps using a font atlas and SDF.

### Advanced Users

The purpose of this component is to enable basic 3D graphing and explore the uses of D3 in A-Frame. If you are an expert D3 user (which I am not) you are probably better off using D3 to manipulate A-Frame directly as you will have more control (e.g. parsing data and using transitions). Be aware that [not everything works 100%](http://codepen.io/bryik/pen/ONdyJR). Forking this project might get you part of the way or at least give you some ideas, since it is built on the [A-Frame component boilerplate](https://github.com/ngokevin/aframe-component-boilerplate) the standard dev commands are available ("npm run dev" for a live server).

### UTF-8

Since D3 is a dependency, you'll need to set the charset to UTF-8 in the script tag.

```html
<script src="https://rawgit.com/bryik/aframe-graph-component/master/dist/aframe-graph-component.min.js" charset="utf-8"></script>
```

### TODO

1) Fix label/text issue

2) Add axes tick labels

3) Add some examples

4) Allow custom axis labels

5) Support for ordinal data

6) Other chart types (e.g. 3D bar, network)

*) Figure out how to get max anisotropy for user's GPU

#### Browser Installation

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.2.0/aframe.min.js"></script>
  <script src="https://rawgit.com/bryik/aframe-graph-component/master/dist/aframe-graph-component.min.js" charset="utf-8"></script>
</head>

<body>
  <a-scene>
    <a-entity graph="csv: myData.csv; type: scatter"></a-entity>
  </a-scene>
</body>
```
