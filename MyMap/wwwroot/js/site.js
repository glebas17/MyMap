var { Draw, Select, Modify, Snap } = ol.interaction;
var Map = ol.Map;
var Overlay = ol.Overlay;
var View = ol.View;
var { Fill, Stroke, Style, Circle: CircleStyle } = ol.style;
var { LineString, Polygon } = ol.geom;
var { OSM, Vector: VectorSource } = ol.source;
var { Tile: TileLayer, Vector: VectorLayer } = ol.layer;
var { getArea, getLength } = ol.sphere;
var { unByKey } = ol.Observable;
var MultiPoint = ol.geom.MultiPoint;
var GeoJSON = ol.format.GeoJSON;
var View = ol.View;

var geojsonObject = {
    type: 'FeatureCollection',
    crs: {
        type: 'name',
        properties: {
            name: 'EPSG:3857',
        },
    },
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [-2e6, 6e6],
                        [-2e6, 8e6],
                        [0, 8e6],
                        [0, 6e6],
                        [-2e6, 6e6],
                    ],
                ],
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [1e6, 6e6],
                        [1e6, 8e6],
                        [3e6, 8e6],
                        [3e6, 6e6],
                        [1e6, 6e6],
                    ],
                ],
            },
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [-2e6, -1e6],
                        [-1e6, 1e6],
                        [0, -1e6],
                        [-2e6, -1e6],
                    ],
                ],
            },
        },
    ],
};

var source = new VectorSource({
    features: new GeoJSON().readFeatures(geojsonObject),
});

var raster = new TileLayer({
    source: new OSM(),
});

var baseLayer = new VectorLayer({
    source: source,
    style: new Style({
        fill: new Fill({
            color: 'rgba(255, 255, 255, 0.2)',
        }),
        stroke: new Stroke({
            color: '#4287f5',
            width: 2,
        }),
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({
                color: '#ffcc33',
            }),
        }),
    }),
});

var measuresLayer = new VectorLayer({
    source: new VectorSource(),
    style: new Style({
        fill: new Fill({
            color: 'rgba(255, 255, 255, 0.2)',
        }),
        stroke: new Stroke({
            color: 'yellow',
            width: 2,
        }),
        image: new CircleStyle({
            radius: 7,
            fill: new Fill({
                color: '#ffcc33',
            }),
        }),
    }),
});

/**
 * Currently drawn feature.
 */
var sketch;

/**
 * The help tooltip element.
 */
var helpTooltipElement;

/**
 * Overlay to show the help messages.
 */
var helpTooltip;

/**
 * The measure tooltip element.
 */
var measureTooltipElement;

/**
 * Overlay to show the measurement.
 */
var measureTooltip;

/**
 * Message to show when the user is drawing a polygon.
 */
var continuePolygonMsg = 'Click to continue drawing the polygon';

/**
 * Message to show when the user is drawing a line.
 */
var continueLineMsg = 'Click to continue drawing the line';

/**
 * Handle pointer move.
 */
var pointerMoveHandler = function (evt) {
    if (evt.dragging) {
        return;
    }

    var helpMsg = 'Click to start drawing';

    if (sketch) {
        var geom = sketch.getGeometry();
        if (geom instanceof Polygon) {
            helpMsg = continuePolygonMsg;
        } else if (geom instanceof LineString) {
            helpMsg = continueLineMsg;
        }
    }

    helpTooltipElement.innerHTML = helpMsg;
    helpTooltip.setPosition(evt.coordinate);

    helpTooltipElement.classList.remove('hidden');
};

var map = new Map({
    layers: [raster, baseLayer, measuresLayer],
    target: 'map',
    view: new View({
        center: [0, 3000000],
        zoom: 2,
    }),
});

map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
    helpTooltipElement.classList.add('hidden');
});

var typeSelect = document.getElementById('draw-type');

/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
var formatLength = function (line) {
    var length = getLength(line);
    var output;
    if (length > 100) {
        output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
    } else {
        output = Math.round(length * 100) / 100 + ' ' + 'm';
    }
    return output;
};

/**
 * Format area output.
 * @param {Polygon} polygon The polygon.
 * @return {string} Formatted area.
 */
var formatArea = function (polygon) {
    var area = getArea(polygon);
    var output;
    if (area > 10000) {
        output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
    } else {
        output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
    }
    return output;
};

/**
 * Creates a new help tooltip
 */
function createHelpTooltip() {
    if (helpTooltipElement) {
        helpTooltipElement.parentNode.removeChild(helpTooltipElement);
    }
    helpTooltipElement = document.createElement('div');
    helpTooltipElement.className = 'ol-tooltip hidden';
    helpTooltip = new Overlay({
        element: helpTooltipElement,
        offset: [15, 0],
        positioning: 'center-left',
    });
    map.addOverlay(helpTooltip);
}

var featuresTooltips = {};

/**
 * Creates a new measure tooltip
 */
function createMeasureTooltip() {
    if (measureTooltipElement) {
        measureTooltipElement.parentNode.removeChild(measureTooltipElement);
    }

    measureTooltipElement = document.createElement('div');
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';

    measureTooltip = new Overlay({
        element: measureTooltipElement,
        offset: [0, -15],
        positioning: 'bottom-center',
    });

    map.addOverlay(measureTooltip);
}

function hasPolygonVertex(geometry, vertexCoordinate) {
    if (!(geometry instanceof Polygon)) {
        return false;
    }

    var coordinates = geometry.getCoordinates();

    return coordinates.some((item) => {
        return item.some((coordinate) => {
            return (
                coordinate[0] === vertexCoordinate[0] &&
                coordinate[1] === vertexCoordinate[1]
            );
        });
    });
}

function hasFeatureCoordinate(feature, coordinate) {
    var geometry = feature.getGeometry();
    var type = geometry.getType();

    switch (type) {
        case 'Polygon': {
            return hasPolygonVertex(geometry, coordinate);
        }

        default: {
            return false;
        }
    }
}

var ExampleModify = {
    init: function () {
        this.select = new Select();
        map.addInteraction(this.select);

        this.modify = new Modify({
            features: this.select.getFeatures(),
        });
        map.addInteraction(this.modify);

        this.modify.on('modifystart', function (evt) {
            var feature = evt.features.array_[0];
            var featureId = feature && feature['ol_uid'];
            var featureTooltip = featuresTooltips[featureId];

            if (!featureTooltip) {
                return;
            }

            feature.getGeometry().on('change', function (evt) {
                var geom = evt.target;
                var output;
                var tooltipCoord;

                if (geom instanceof Polygon) {
                    output = formatArea(geom);
                    tooltipCoord = geom.getInteriorPoint().getCoordinates();
                } else if (geom instanceof LineString) {
                    output = formatLength(geom);
                    tooltipCoord = geom.getLastCoordinate();
                }

                featureTooltip.element.innerHTML = output;
                featureTooltip.overlay.setPosition(tooltipCoord);
            });
        });

        this.setEvents();
    },
    setEvents: function () {
        var selectedFeatures = this.select.getFeatures();

        this.select.on('change:active', function () {
            selectedFeatures.forEach(function (each) {
                selectedFeatures.remove(each);
            });
        });
    },
    setActive: function (active) {
        this.select.setActive(active);
        this.modify.setActive(active);
    },
};

ExampleModify.init();

var optionsForm = document.getElementById('options-form');

var currentMeasurableFeature = null;

var ExampleDraw = {
    init: function () {
        createMeasureTooltip();
        createHelpTooltip();

        this.addInteraction();
    },
    addInteraction: function () {
        this.draw = new Draw({
            source: measuresLayer.getSource(),
            type: this.getDrawingType(),
            maxPoints: 2,
            minPoints: 2,
            condition: function (evt) {
                if (evt.type === 'pointerdown') {
                    var { coordinate_: coordinate } = evt;

                    var closestFeature = source.getClosestFeatureToCoordinate(coordinate);

                    if (
                        !closestFeature ||
                        (currentMeasurableFeature &&
                            currentMeasurableFeature.ol_uid !== closestFeature.ol_uid)
                    ) {
                        return false;
                    }

                    currentMeasurableFeature = closestFeature;

                    return hasFeatureCoordinate(closestFeature, coordinate);
                }

                return true;
            },
            style: new Style({
                fill: new Fill({
                    color: 'rgba(255, 255, 255, 0.2)',
                }),
                stroke: new Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2,
                }),
                image: new CircleStyle({
                    radius: 5,
                    stroke: new Stroke({
                        color: 'rgba(0, 0, 0, 0.7)',
                    }),
                    fill: new Fill({
                        color: 'rgba(255, 255, 255, 0.2)',
                    }),
                }),
            }),
        });

        map.addInteraction(this.draw);

        var listener;

        this.draw.on('drawstart', function (evt) {
            // set sketch
            sketch = evt.feature;

            var tooltipCoord = evt.coordinate;

            listener = sketch.getGeometry().on('change', function (evt) {
                var geom = evt.target;
                var output;
                if (geom instanceof Polygon) {
                    output = formatArea(geom);
                    tooltipCoord = geom.getInteriorPoint().getCoordinates();
                } else if (geom instanceof LineString) {
                    output = formatLength(geom);
                    tooltipCoord = geom.getLastCoordinate();
                }
                measureTooltipElement.innerHTML = output;
                measureTooltip.setPosition(tooltipCoord);
            });
        });

        this.draw.on('drawend', function (evt) {
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
            measureTooltip.setOffset([0, -7]);

            var geometry = evt.feature.getGeometry();

            if (geometry instanceof LineString) {
                var midpoint = geometry.getFlatMidpoint();
                measureTooltip.setPosition(midpoint);
            }

            var featureId = evt.feature.ol_uid;

            featuresTooltips[featureId] = {
                element: measureTooltipElement,
                overlay: measureTooltip,
            };

            // unset sketch
            sketch = null;
            // unset tooltip so that a new one can be created
            measureTooltipElement = null;
            currentMeasurableFeature = null;

            createMeasureTooltip();

            unByKey(listener);
        });
    },
    removeInteraction: function () {
        map.removeInteraction(this.draw);
    },
    getDrawingType: function () {
        return typeSelect.value;
    },
    changeDrawType: function () {
        this.removeInteraction();
        this.addInteraction();
    },
    setActive: function (active) {
        this.draw.setActive(active);
    },
};

ExampleDraw.init();

/**
 * Let user change the geometry type.
 * @param {Event} e Change event.
 */
optionsForm.onchange = function (e) {
    var type = e.target.getAttribute('name');
    var value = e.target.value;

    if (type === 'draw-type') {
        ExampleDraw.changeDrawType();
    } else if (type === 'interaction') {
        if (value === 'modify') {
            ExampleDraw.setActive(false);
            ExampleModify.setActive(true);
        } else if (value === 'draw') {
            ExampleDraw.setActive(true);
            ExampleModify.setActive(false);
        }
    }
};

ExampleDraw.setActive(true);
ExampleModify.setActive(false);

var snap = new Snap({
    source: baseLayer.getSource(),
});
map.addInteraction(snap);
