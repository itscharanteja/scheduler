#!/bin/bash

echo "1️⃣  Testing GET /api/chat/channels"
curl -s "http://localhost:3000/api/chat/channels?locationId=22222222-2222-4222-8222-222222222222" | jq '.channels | length'

echo "2️⃣  Testing GET /api/chat/messages"
curl -s "http://localhost:3000/api/chat/messages?channelId=28aedb43-8c66-4470-bc96-108238767654" | jq '.count'

echo "3️⃣  Testing POST /api/chat/send"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -d "{
    \"channelId\": \"28aedb43-8c66-4470-bc96-108238767654\",
    \"senderId\": \"33333333-3333-4333-8333-333333333301\",
    \"message\": \"Test at $(date)\"
  }")
echo $RESPONSE | jq '.success'

echo "4️⃣  Testing GET /api/chat/pinned"
curl -s "http://localhost:3000/api/chat/pinned?channelId=28aedb43-8c66-4470-bc96-108238767654" | jq '.count'

echo "✅ All tests completed"  