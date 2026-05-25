# Postman Example: Subject Line Optimiser

## Request

- Method: `POST`
- URL: `http://127.0.0.1:3001/api/ai/subject-lines`
- Headers:
  - `Content-Type: application/json`

## Body (raw JSON)

```json
{
  "brief": "Sell ERP software to CFOs in Saudi Arabia",
  "industry": "Manufacturing",
  "targetRole": "CFO",
  "country": "Saudi Arabia",
  "tone": "professional"
}
```

## Expected Success Response

```json
{
  "success": true,
  "subjectLines": [
    {
      "style": "Curiosity",
      "subject": "What could improve your qualified pipeline in 30 days?",
      "score": 8,
      "reason": "Curiosity framing invites opens."
    }
  ]
}
```

## Expected Validation Error

```json
{
  "success": false,
  "error": {
    "message": "brief is required and must be a non-empty string.",
    "code": "VALIDATION_ERROR"
  }
}
```
