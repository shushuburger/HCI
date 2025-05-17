import requests
import pandas as pd
import time
import os
from datetime import datetime

# 인코딩된 API 키
API_KEY = "MNUICj9LF0yMX9b9cMQiBVz62JWYaqaGxBOIATmwvQgzkfdHQjzCouGaBLIzyg6MYGQOHqefVCRf3E23XoqVGA%3D%3D"

# 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

STATION_LIST_FILE = os.path.join(DATA_DIR, "측정소_목록.xlsx")
CSV_FILE = os.path.join(DATA_DIR, "울산_미세먼지_데이터.csv")
XLSX_FILE = os.path.join(DATA_DIR, "울산_미세먼지_데이터.xlsx")

# 울산 측정소만 불러오기
def load_ulsan_stations():
    try:
        df = pd.read_excel(STATION_LIST_FILE)
        ulsan_df = df[df["addr"].str.contains("울산")]
        return ulsan_df["stationName"].dropna().unique().tolist()
    except Exception as e:
        print("❌ 측정소 목록 불러오기 실패:", e)
        return []

# 미세먼지 데이터 수집
def fetch_dust_data(stations):
    results = []
    for station in stations:
        encoded_station = requests.utils.quote(station, safe='')
        url = (
            f"http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
            f"?serviceKey={API_KEY}"
            f"&returnType=json"
            f"&numOfRows=1"
            f"&pageNo=1"
            f"&stationName={encoded_station}"
            f"&dataTerm=DAILY"
            f"&ver=1.0"
        )
        try:
            res = requests.get(url, timeout=5)
            if res.status_code != 200 or not res.text.strip():
                raise ValueError("응답 없음 또는 상태 오류")

            data = res.json()
            items = data.get("response", {}).get("body", {}).get("items", [])
            if not items:
                raise ValueError("데이터 없음")

            item = items[0]
            results.append({
                "수집시각": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "측정시각": item.get("dataTime", ""),
                "측정소": station,
                "PM10": item.get("pm10Value", ""),
                "PM2.5": item.get("pm25Value", ""),
                "통합지수": item.get("khaiValue", ""),
                "오존": item.get("o3Value", ""),
                "이산화질소": item.get("no2Value", ""),
                "일산화탄소": item.get("coValue", ""),
                "아황산가스": item.get("so2Value", "")
            })
        except Exception as e:
            print(f"⚠️ {station} 오류: {e}")
        time.sleep(0.5)  # 울산은 측정소 수가 적으니 0.5초로 여유있게
    return pd.DataFrame(results)

# 저장
def append_and_save(new_df):
    if os.path.exists(CSV_FILE):
        existing_df = pd.read_csv(CSV_FILE)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        combined_df = new_df

    combined_df.to_csv(CSV_FILE, index=False, encoding="utf-8-sig")
    combined_df.to_excel(XLSX_FILE, index=False)
    print(f"✅ 저장 완료: {len(new_df)}개 항목")

# 실행
if __name__ == "__main__":
    stations = load_ulsan_stations()
    print(f"📍 울산 측정소 수: {len(stations)}개")

    new_data = fetch_dust_data(stations)

    if not new_data.empty:
        append_and_save(new_data)
    else:
        print("❌ 수집된 데이터가 없습니다.")
