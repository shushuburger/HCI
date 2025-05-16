document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7); // 전국 중심

  // 지도 배경 타일 제거 (흰 배경)
  // 아무 것도 안 넣으면 배경 없음 (우리는 GeoJSON만 표시)

  // GeoJSON 로드 및 시도 필터링 (예: 울산)
  fetch('/HCI/assets/geo/korea-sigungu.json')
    .then(res => res.json())
    .then(geojson => {
      const filtered = {
        ...geojson,
        features: geojson.features.filter(
          f => f.properties.SIDO_KOR_NM === '울산광역시' // 여기 수정 가능
        )
      };

      L.geoJSON(filtered, {
        style: {
          color: '#000',
          weight: 1.5,
          fillColor: '#fff',
          fillOpacity: 1
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties.SIG_KOR_NM;
          layer.bindTooltip(name, {
            permanent: false,
            direction: 'center',
            className: 'region-tooltip'
          });
        }
      }).addTo(map);
    })
    .catch(err => {
      console.error('❌ GeoJSON 로드 오류:', err);
    });
});
