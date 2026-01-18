#!/bin/bash
# Generate test CSV with specified number of rows
ROWS=${1:-1000}
OUTPUT=${2:-"test-${ROWS}.csv"}

REGIONS=("North" "South" "East" "West" "Central")
CATEGORIES=("Electronics" "Clothing" "Food" "Books" "Home" "Sports" "Auto" "Health")
STATUSES=("active" "pending" "completed" "cancelled")

echo "id,region,category,status,revenue,quantity,discount,date,customer_id,rating" > "$OUTPUT"

for i in $(seq 1 $ROWS); do
    region=${REGIONS[$RANDOM % ${#REGIONS[@]}]}
    category=${CATEGORIES[$RANDOM % ${#CATEGORIES[@]}]}
    status=${STATUSES[$RANDOM % ${#STATUSES[@]}]}
    revenue=$(echo "scale=2; $RANDOM / 10" | bc)
    quantity=$((RANDOM % 100 + 1))
    discount=$(echo "scale=2; ($RANDOM % 50) / 100" | bc)
    year=$((2020 + RANDOM % 5))
    month=$((RANDOM % 12 + 1))
    day=$((RANDOM % 28 + 1))
    date=$(printf "%04d-%02d-%02d" $year $month $day)
    customer_id=$((RANDOM % 89999 + 10000))
    rating=$(echo "scale=1; ($RANDOM % 40 + 10) / 10" | bc)
    
    echo "$i,$region,$category,$status,$revenue,$quantity,$discount,$date,$customer_id,$rating"
done >> "$OUTPUT"

echo "Generated $OUTPUT with $ROWS rows"
