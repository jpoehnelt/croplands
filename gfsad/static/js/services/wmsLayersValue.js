app.value('wmsLayers', {
    gfsad1000v00: {
        name: 'Global Cropland Extent (GCE) 1km Crop Dominance',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        visible: false,
        infoVisible: false,
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-10559428504955428209-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7,
            attribution: '<a href="https://powellcenter.usgs.gov/globalcroplandwater/sites/default/files/August%20HLA-final-1q-high-res.pdf">Thenkabail et al., 2012</a>'

        },
        legendVisible: false,
        legend: [
            {label: 'Irrigated: Wheat and Rice Dominant', color: '#0000FF'},
            {label: 'Irrigated: Mixed Crops 1: Wheat, Rice, Barley, Soybeans', color: '#A020EF'},
            {label: 'Irrigated: Mixed Crops 2: Corn, Wheat, Rice, Cotton, Orchards', color: '#FF00FF'},
            {label: 'Rainfed: Wheat, Rice, Soybeans, Sugarcane, Corn, Cassava', color: '#00FFFF'},
            {label: 'Rainfed: Wheat and Barley Dominant', color: '#FFFF00'},
            {label: 'Rainfed: Corn and Soybeans Dominant', color: '#007A0B'},
            {label: 'Rainfed: Mixed Crops 1: Wheat, Corn, Rice, Barley, Soybeans', color: '#00FF00'},
            {label: 'Minor Fractions of Mixed Crops: Wheat, Maize, Rice, Barley, Soybeans', color: '#505012'},
            {label: 'Other Classes', color: '#B2B2B2'}
        ]
    },
    gfsad1000v10: {
        name: 'Global Cropland Extent (GCE) 1km Multi-study Crop Mask',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        visible: false,
        infoVisible: false,
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-16382460135717964770-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7,
            attribution: '<a href="http://geography.wr.usgs.gov/science/croplands/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>'
        },
        legendVisible: false,
        legend: [
            {label: 'Croplands, Irrigation major', color: '#FF00FF'},
            {label: 'Croplands, Irrigation minor', color: '#00FF00'},
            {label: 'Croplands, Rainfed', color: '#FFFF00'},
            {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
            {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}

        ]
    }
});