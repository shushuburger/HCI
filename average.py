import pandas as pd

# 파일 불러오기
data_df = pd.read_csv("data/전국_미세먼지_데이터.xlsx")
stations_df = pd.read_excel("data/측정소_목록.xlsx")

# 주소에서 '구' 정보 추출 (예: "울산광역시 남구 삼산동" → "남구")
stations_df["구"] = stations_df["addr"].str.extract(r"(\w+구)")

# 필요한 컬럼만 정리
stations_df = stations_df[["stationName", "구"]].dropna()

# 데이터프레임 병합
merged_df = pd.merge(data_df, stations_df, on="stationName", how="left")

# 구별 평균값 계산
grouped = merged_df.groupby("구")[["PM10", "PM2.5", "오존", "이산화질소", "일산화탄소", "아황산가스"]].mean()

# 결과 확인
print(grouped.round(2))
