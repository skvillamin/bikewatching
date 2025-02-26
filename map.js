import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let timeFilter = -1;

mapboxgl.accessToken = 'pk.eyJ1Ijoic2t2aWxsYW1pbiIsImEiOiJjbTdqdDFtOHowMDR0Mm1wdG5vejlqa3Z3In0.wqG0y-DMbv2lB5UtMkbmmA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/light-v11', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', async () => { 
    // First event listener for Boston routes


    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });
    map.addLayer({
        id: 'boston-bike-lanes', // Changed ID to be unique
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': 'orange',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });

    // Second event listener for Cambridge routes
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'cambridge-bike-lanes', // Changed ID to be unique
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': 'orange',
            'line-width': 3,
            'line-opacity': 0.4
        }

    });
    let jsonData;
    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        
        let stations = jsonData.data.stations;

        // Load traffic data
        const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        const trips = await d3.csv(trafficUrl);

        // Calculate departures and arrivals
        const departures = d3.rollup(
            trips,
            v => v.length,
            d => d.start_station_id
        );

        const arrivals = d3.rollup(
            trips,
            v => v.length,
            d => d.end_station_id
        );

        // Now use these in the stations mapping
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;  // Fixed typo
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);
        

        const svg = d3.select('#map').select('svg');
        const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))  // Use radiusScale here
        svg.selectAll('circle')
        // all other previously defined attributes omitted for brevity
        .each(function(d) {
            // Add <title> for browser tooltips
            d3.select(this)
            .append('title')
            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });

        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
            circles
              .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
              .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
          }
      
        // Initial position update when map loads
        updatePositions();
        // Reposition markers on map interactions
        map.on('move', updatePositions);     // Update during map movement
        map.on('zoom', updatePositions);     // Update during zooming
        map.on('resize', updatePositions);   // Update on window resize
        map.on('moveend', updatePositions);  // Final adjustment after movement ends
      
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

});

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
  }
