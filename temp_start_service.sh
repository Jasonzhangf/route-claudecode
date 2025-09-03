#!/bin/bash
# Temporary script to start RCC4 service
cd /Users/fanzhang/.route-claudecode/config/v4/single-provider
rcc4 start --config shuaihong-v4-5507-demo1-enhanced.json --port 5507 &
echo "RCC4 service started on port 5507"