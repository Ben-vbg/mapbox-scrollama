let initLoad = true;
let layerTypes = {
  'fill': ['fill-opacity'],
  'line': ['line-opacity'],
  'circle': ['circle-opacity', 'circle-stroke-opacity'],
  'symbol': ['icon-opacity', 'text-opacity'],
  'raster': ['raster-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  'heatmap': ['heatmap-opacity']
}

let alignments = {
  'left': 'lefty',
  'center': 'centered',
  'right': 'righty',
  'full': 'fully'
}

function getLayerPaintType(layer) {
  let layerType = map.getLayer(layer).type;
  return layerTypes[layerType];
}

function setLayerOpacity(layer) {
  let paintProps = getLayerPaintType(layer.layer);
  paintProps.forEach(function(prop) {
    let options = {};
    if (layer.duration) {
      let transitionProp = prop + "-transition";
      options = { "duration": layer.duration };
      map.setPaintProperty(layer.layer, transitionProp, options);
    }
    map.setPaintProperty(layer.layer, prop, layer.opacity, options);
  });
}

let story = document.getElementById('story');
let features = document.createElement('div');
features.setAttribute('id', 'features');

let header = document.createElement('div');

if (config.title) {
  let titleText = document.createElement('h1');
  titleText.innerText = config.title;
  header.appendChild(titleText);
}

if (config.subtitle) {
  let subtitleText = document.createElement('h2');
  subtitleText.innerText = config.subtitle;
  header.appendChild(subtitleText);
}

if (config.byline) {
  let bylineText = document.createElement('p');
  bylineText.innerText = config.byline;
  header.appendChild(bylineText);
}

if (header.innerText.length > 0) {
  header.classList.add(config.theme);
  header.setAttribute('id', 'header');
  story.appendChild(header);
}

config.chapters.forEach((record, idx) => {
  let container = document.createElement('div');
  let chapter = document.createElement('div');

  if (record.title) {
    let title = document.createElement('h3');
    title.innerText = record.title;
    chapter.appendChild(title);
  }

  if (record.image) {
    let image = new Image();
    image.src = record.image;
    chapter.appendChild(image);
  }

  if (record.description) {
    let story = document.createElement('p');
    story.innerHTML = record.description;
    chapter.appendChild(story);
  }

  container.setAttribute('id', record.id);
  container.classList.add('step');
  if (idx === 0) {
    container.classList.add('active');
  }

  chapter.classList.add(config.theme);
  container.appendChild(chapter);
  container.classList.add(alignments[record.alignment] || 'centered');
  if (record.hidden) {
    container.classList.add('hidden');
  }
  features.appendChild(container);
});

story.appendChild(features);

let footer = document.createElement('div');

if (config.footer) {
  let footerText = document.createElement('p');
  footerText.innerHTML = config.footer;
  footer.appendChild(footerText);
}

if (footer.innerText.length > 0) {
  footer.classList.add(config.theme);
  footer.setAttribute('id', 'footer');
  story.appendChild(footer);
}

mapboxgl.accessToken = config.accessToken;

const transformRequest = (url) => {
  const hasQuery = url.indexOf("?") !== -1;
  const suffix = hasQuery ? "&pluginName=scrollytellingV2" : "?pluginName=scrollytellingV2";
  return {
    url: url + suffix
  }
}

// -----------------------------------------------------------------------------------
// ---------------------------- Creation de la carte ---------------------------------
// -----------------------------------------------------------------------------------

let map = new mapboxgl.Map({
  container: 'map',
  style: config.style,
  center: config.chapters[0].location.center,
  zoom: config.chapters[0].location.zoom,
  bearing: config.chapters[0].location.bearing,
  pitch: config.chapters[0].location.pitch,
  interactive: false,
  transformRequest: transformRequest,
  projection: config.projection
});

// Mini carte

let insetMap = new mapboxgl.Map({
  container: 'mapInset',
  style: 'mapbox://styles/benjimare/clpuxcwlv01ey01o0gzeufrkj',
  center: config.chapters[0].location.center,
  zoom: 3, // starting zoom
  hash: false,
  interactive: false,
  attributionControl: false,
});


if (config.showMarkers) {
  let marker = new mapboxgl.Marker({ color: config.markerColor });
  marker.setLngLat(config.chapters[0].location.center).addTo(map);
}

// instantiate the scrollama
let scroller = scrollama();


map.on("load", function() {
  if (config.use3dTerrain) {
    map.addSource('mapbox-dem', {
      'type': 'raster-dem',
      'url': 'mapbox://styles/benjimare/clpuxcwlv01ey01o0gzeufrkj',
      'tileSize': 512,
      'maxzoom': 14
    });
    // add the DEM source as a terrain layer with exaggerated height
    map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

    // add a sky layer that will show when the map is highly pitched
    map.addLayer({
      'id': 'sky',
      'type': 'sky',
      'paint': {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 0.0],
        'sky-atmosphere-sun-intensity': 15
      }
    });
  };

  // As the map moves, grab and update bounds in inset map.
  if (config.inset) {
    map.on('move', getInsetBounds);
  }
  // setup the instance, pass callback functions
  scroller
  .setup({
    step: '.step',
    offset: 0.5,
    progress: true
  })
  .onStepEnter(async response => {
    let current_chapter = config.chapters.findIndex(chap => chap.id === response.element.id);
    let chapter = config.chapters[current_chapter];

    response.element.classList.add('active');
    map[chapter.mapAnimation || 'flyTo'](chapter.location);

    // Incase you do not want to have a dynamic inset map,
    // rather want to keep it a static view but still change the
    // bbox as main map move: comment out the below if section.
    if (config.inset) {
      if (chapter.location.zoom < 5) {
        insetMap.flyTo({center: chapter.location.center, zoom: 0});
      }
      else {
        insetMap.flyTo({center: chapter.location.center, zoom: 3});
      }
    }
    if (config.showMarkers) {
      marker.setLngLat(chapter.location.center);
    }
    if (chapter.onChapterEnter.length > 0) {
      chapter.onChapterEnter.forEach(setLayerOpacity);
    }
    if (chapter.callback) {
      window[chapter.callback]();
    }
    if (chapter.rotateAnimation) {
      map.once('moveend', () => {
        const rotateNumber = map.getBearing();
        map.rotateTo(rotateNumber + 180, {
          duration: 30000, easing: function (t) {
            return t;
          }
        });
      });
    }
    if (config.auto) {
      let next_chapter = (current_chapter + 1) % config.chapters.length;
      map.once('moveend', () => {
        document.querySelectorAll('[data-scrollama-index="' + next_chapter.toString() + '"]')[0].scrollIntoView();
      });
    }
  })
  .onStepExit(response => {
    let chapter = config.chapters.find(chap => chap.id === response.element.id);
    response.element.classList.remove('active');
    if (chapter.onChapterExit.length > 0) {
      chapter.onChapterExit.forEach(setLayerOpacity);
    }
  });


  if (config.auto) {
    document.querySelectorAll('[data-scrollama-index="0"]')[0].scrollIntoView();
  }
});

//Helper functions for insetmap
function getInsetBounds() {
  let bounds = map.getBounds();

  let boundsJson = {
    "type": "FeatureCollection",
    "features": [{
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              bounds._sw.lng,
              bounds._sw.lat
            ],
            [
              bounds._ne.lng,
              bounds._sw.lat
            ],
            [
              bounds._ne.lng,
              bounds._ne.lat
            ],
            [
              bounds._sw.lng,
              bounds._ne.lat
            ],
            [
              bounds._sw.lng,
              bounds._sw.lat
            ]
          ]
        ]
      }
    }]
  }

  if (initLoad) {
    addInsetLayer(boundsJson);
    initLoad = false;
  } else {
    updateInsetLayer(boundsJson);
  }

}

function addInsetLayer(bounds) {
  insetMap.addSource('boundsSource', {
    'type': 'geojson',
    'data': bounds
  });

  insetMap.addLayer({
    'id': 'boundsLayer',
    'type': 'fill',
    'source': 'boundsSource', // reference the data source
    'layout': {},
    'paint': {
      'fill-color': '#fff', // blue color fill
      'fill-opacity': 0.2
    }
  });

  // Add a black outline around the polygon.
  insetMap.addLayer({
    'id': 'outlineLayer',
    'type': 'line',
    'source': 'boundsSource',
    'layout': {},
    'paint': {
      'line-color': 'blue',
      'line-width': 1
    }
  });
}

function updateInsetLayer(bounds) {
  insetMap.getSource('boundsSource').setData(bounds);
}

// setup resize event
window.addEventListener('resize', scroller.resize);
