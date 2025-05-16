document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true
    }).setView([36.5, 127.5], 7); // 초기 중심 (전국)

    // ✅ 내 위치 받아서 중심만 이동
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            map.setView([lat, lon], 11); // 중심만 내 위치로 이동
            L.marker([lat, lon]).addTo(map).bindPopup('📍 현재 위치').openPopup();
        },
        (err) => {
            console.error('❌ 위치 정보 오류:', err);
            alert('위치 정보를 가져올 수 없습니다.');
        }
    );

    // ✅ 전국 전체 GeoJSON 표시 (필터 X)
    fetch('/HCI/assets/geo/korea-sigungu.json')
        .then(res => res.json())
        .then(geojson => {
            L.geoJSON(geojson, {
                style: {
                    color: '#000',
                    weight: 1.5,
                    fillColor: '#fff',
                    fillOpacity: 1
                },
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.name;
                    layer.bindTooltip(name, {
                        permanent: true,          // 항상 보임
                        direction: 'center',      // 중앙에 위치
                        className: 'region-tooltip'
                    });
                }
            }).addTo(map);
        })
        .catch(err => {
            console.error('❌ GeoJSON 로드 오류:', err);
        });
});
