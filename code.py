import json

# 파일 경로
file_path = r'assets/geo/korea-sigungu.json'

# JSON 파일 열기
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 모든 feature의 properties만 추출
properties_list = [feature['properties'] for feature in data['features']]

# 결과 확인 (예: 5개만 미리보기)
for p in properties_list[:5]:
    print(p)

# 필요하다면 pandas로 변환
import pandas as pd
df = pd.DataFrame(properties_list)

df.to_csv('sigungu_properties.csv', index=False, encoding='utf-8-sig')
