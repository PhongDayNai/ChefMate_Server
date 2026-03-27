# Recipe Crawl Dataset (BBC Good Food)

- Target: 1000
- Collected: 1000
- Elapsed: ~202s

## Files
- `recipes.json`: full normalized dataset
- `recipes.jsonl`: JSONL per recipe
- `import_payload_templates.jsonl`: payload template ready for API mapping
- `images/`: downloaded recipe images

## API Mapping Notes
Use each object in `importPayloadTemplate` with multipart/form-data:
- Keep `ingredients`, `cookingSteps`, `tags` as JSON-string fields
- Replace `userId` placeholder before sending
- Upload `image` from local file path