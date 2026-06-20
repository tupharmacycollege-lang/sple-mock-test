# SPLE Mock Test Platform

## هيكل المشروع
```
sple-final/
├── src/
│   ├── App.jsx          ← React (محدّث - API + Assignment)
│   └── index.js
├── public/
│   └── index.html
├── lambda/
│   └── index.mjs        ← Lambda (محدّث - يدعم PATCH)
├── amplify.yml
├── package.json
├── upload_questions.py  ← رفع الأسئلة لـ DynamoDB
└── sple_questions.json  ← 1,958 سؤال
```

## التغييرات الجديدة
- ✅ الأسئلة تجيب من DynamoDB عبر API
- ✅ الأدمن يحدد كل سؤال: Study / Exam / Both
- ✅ Bulk Assign لتعيين أسئلة متعددة دفعة واحدة
- ✅ الطالب يشوف الأسئلة المعينة له فقط

## خطوات النشر
1. ارفع `src/App.jsx` على GitHub → Amplify يبني تلقائياً
2. ارفع `lambda/index.mjs` على AWS Lambda → Deploy
