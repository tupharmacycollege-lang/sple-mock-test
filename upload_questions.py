#!/usr/bin/env python3
"""
رفع أسئلة SPLE من Excel إلى DynamoDB
"""
import json
import pandas as pd
import boto3
from boto3.dynamodb.conditions import Key
import time

# إعدادات
EXCEL_FILE = "/mnt/user-data/uploads/ORION_SPLE_final.xlsx"
TABLE_NAME = "sple-questions"
REGION = "eu-north-1"

def upload_questions():
    # قراءة الملف
    print("📖 قراءة ملف Excel...")
    df = pd.read_excel(EXCEL_FILE)
    print(f"✅ تم تحميل {len(df)} سؤال")

    # الاتصال بـ DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)

    success = 0
    failed = 0

    print("🚀 بدء الرفع إلى DynamoDB...")
    
    with table.batch_writer() as batch:
        for i, row in df.iterrows():
            try:
                item = {
                    "id": f"q_{i+1:04d}",
                    "section": str(row['section']) if pd.notna(row['section']) else "",
                    "category": str(row['category']) if pd.notna(row['category']) else "",
                    "difficulty": str(row['difficulty']) if pd.notna(row['difficulty']) else "",
                    "question": str(row['question']) if pd.notna(row['question']) else "",
                    "options": [
                        str(row['option_a']) if pd.notna(row['option_a']) else "",
                        str(row['option_b']) if pd.notna(row['option_b']) else "",
                        str(row['option_c']) if pd.notna(row['option_c']) else "",
                        str(row['option_d']) if pd.notna(row['option_d']) else "",
                    ],
                    "answer": int(row['correct_answer']),
                    "explanation": str(row['explanation']) if pd.notna(row['explanation']) else "",
                    "source": "ORION_SPLE",
                    "createdAt": int(time.time())
                }
                batch.put_item(Item=item)
                success += 1
                
                if success % 100 == 0:
                    print(f"  ✅ {success}/{len(df)} سؤال...")
                    
            except Exception as e:
                failed += 1
                print(f"  ❌ خطأ في السطر {i}: {e}")

    print(f"\n✅ تم رفع {success} سؤال بنجاح")
    if failed:
        print(f"❌ فشل {failed} سؤال")

if __name__ == "__main__":
    upload_questions()
