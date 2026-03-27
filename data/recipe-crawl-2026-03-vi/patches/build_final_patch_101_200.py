import json
from collections import defaultdict, Counter

base_patch_path='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/patches/patch_101_200.json'
out_patch='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/patches/final_patch_101_200.json'
out_summary='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/patches/final_summary_101_200.json'

with open(base_patch_path) as f:
    base=json.load(f)

base_patches = base['patches'] if isinstance(base, dict) and 'patches' in base else base

entries={}
reasons=defaultdict(list)
for p in base_patches:
    idx=p['index']
    entries.setdefault(idx,{})
    entries[idx].update(p['changes'])
    reasons[idx].append(p.get('reason','').strip())

extra = {
101: {
  'cookingSteps[0].content': 'Cắt ngang ức gà theo kiểu butterfly (khứa một bên rồi mở ra như quyển sách), phủ giấy nến rồi dùng cây cán bột dần cho dày khoảng 1-2cm. Chuẩn bị trạm tẩm bột: cho bột mì ra một đĩa và nêm muối tiêu; cho vụn bánh mì panko ra đĩa thứ hai; trứng đánh cùng 1 thìa canh dầu ớt trong một bát nông.',
  'importPayloadTemplate.cookingSteps[0].content': 'Cắt ngang ức gà theo kiểu butterfly (khứa một bên rồi mở ra như quyển sách), phủ giấy nến rồi dùng cây cán bột dần cho dày khoảng 1-2cm. Chuẩn bị trạm tẩm bột: cho bột mì ra một đĩa và nêm muối tiêu; cho vụn bánh mì panko ra đĩa thứ hai; trứng đánh cùng 1 thìa canh dầu ớt trong một bát nông.'
 },
103: {
  'ingredients[2].ingredientName':'tỏi băm nhuyễn','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[2].unit':'tép',
  'ingredients[18].ingredientName':'tỏi băm nhuyễn','ingredients[18].unit':'tép',
  'importPayloadTemplate.ingredients[18].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[18].unit':'tép',
 },
104: {
  'ingredients[4].ingredientName':'tỏi băm nhuyễn','ingredients[4].unit':'tép',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[4].unit':'tép',
 },
105: {
  'ingredients[0].ingredientName':'đậu cannellini, đậu butter hoặc đậu pinto',
  'importPayloadTemplate.ingredients[0].ingredientName':'đậu cannellini, đậu butter hoặc đậu pinto',
  'ingredients[4].ingredientName':'tỏi (đập dập, bóc vỏ)','ingredients[4].unit':'củ',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi (đập dập, bóc vỏ)','importPayloadTemplate.ingredients[4].unit':'củ',
  'ingredients[14].ingredientName':'tỏi đập dập','ingredients[14].unit':'tép',
  'importPayloadTemplate.ingredients[14].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[14].unit':'tép',
 },
113: {
  'ingredients[0].ingredientName':'tỏi','ingredients[0].unit':'tép',
  'importPayloadTemplate.ingredients[0].ingredientName':'tỏi','importPayloadTemplate.ingredients[0].unit':'tép',
  'ingredients[13].ingredientName':'nước cốt dừa đóng hộp',
  'importPayloadTemplate.ingredients[13].ingredientName':'nước cốt dừa đóng hộp',
 },
116: {
  'ingredients[7].ingredientName':'tỏi','ingredients[7].unit':'tép',
  'importPayloadTemplate.ingredients[7].ingredientName':'tỏi','importPayloadTemplate.ingredients[7].unit':'tép',
 },
118: {
  'ingredients[2].ingredientName':'dầu ô liu nguyên chất để rưới',
  'importPayloadTemplate.ingredients[2].ingredientName':'dầu ô liu nguyên chất để rưới',
 },
130: {
  'ingredients[12].ingredientName':'tỏi băm nhuyễn','ingredients[12].unit':'tép',
  'importPayloadTemplate.ingredients[12].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[12].unit':'tép',
 },
132: {
  'ingredients[2].ingredientName':'tỏi băm nhuyễn','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[2].unit':'tép',
 },
136: {
  'ingredients[2].ingredientName':'tỏi thái lát mỏng','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi thái lát mỏng','importPayloadTemplate.ingredients[2].unit':'tép',
 },
137: {
  'ingredients[2].ingredientName':'tỏi đập dập','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[2].unit':'tép',
 },
146: {
  'ingredients[3].ingredientName':'tỏi băm nhuyễn','ingredients[3].unit':'tép',
  'importPayloadTemplate.ingredients[3].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[3].unit':'tép',
 },
148: {
  'ingredients[10].ingredientName':'tỏi đập dập','ingredients[10].unit':'tép',
  'importPayloadTemplate.ingredients[10].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[10].unit':'tép',
  'ingredients[15].ingredientName':'tỏi đập dập','ingredients[15].unit':'tép',
  'importPayloadTemplate.ingredients[15].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[15].unit':'tép',
 },
152: {
  'ingredients[12].ingredientName':'đậu đen đóng hộp, để ráo và rửa sạch',
  'importPayloadTemplate.ingredients[12].ingredientName':'đậu đen đóng hộp, để ráo và rửa sạch',
  'ingredients[13].ingredientName':'ngô ngọt đóng hộp, để ráo nước',
  'importPayloadTemplate.ingredients[13].ingredientName':'ngô ngọt đóng hộp, để ráo nước',
 },
154: {
  'ingredients[4].ingredientName':'tỏi bào nhuyễn','ingredients[4].unit':'tép',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi bào nhuyễn','importPayloadTemplate.ingredients[4].unit':'tép',
 },
155: {
  'ingredients[4].ingredientName':'tỏi băm nhuyễn','ingredients[4].unit':'tép',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[4].unit':'tép',
 },
157: {
  'ingredients[5].ingredientName':'tỏi đập dập','ingredients[5].unit':'tép',
  'importPayloadTemplate.ingredients[5].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[5].unit':'tép',
  'ingredients[12].ingredientName':'một ít dầu ô liu nguyên chất để rưới',
  'importPayloadTemplate.ingredients[12].ingredientName':'một ít dầu ô liu nguyên chất để rưới',
 },
160: {
  'ingredients[2].ingredientName':'tỏi','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi','importPayloadTemplate.ingredients[2].unit':'tép',
 },
161: {
  'ingredients[8].ingredientName':'tỏi bào nhuyễn hoặc đập dập','ingredients[8].unit':'tép',
  'importPayloadTemplate.ingredients[8].ingredientName':'tỏi bào nhuyễn hoặc đập dập','importPayloadTemplate.ingredients[8].unit':'tép',
 },
163: {
  'ingredients[4].ingredientName':'tỏi đập dập','ingredients[4].unit':'tép',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[4].unit':'tép',
 },
170: {
  'ingredients[5].ingredientName':'custard đóng hộp',
  'importPayloadTemplate.ingredients[5].ingredientName':'custard đóng hộp',
 },
171: {
  'ingredients[4].ingredientName':'dầu ô liu, thêm một ít để rưới',
  'importPayloadTemplate.ingredients[4].ingredientName':'dầu ô liu, thêm một ít để rưới',
 },
178: {
  'ingredients[2].ingredientName':'tỏi đập dập','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[2].unit':'tép',
  'ingredients[3].ingredientName':'cà chua băm đóng hộp (loại 400g)','ingredients[3].weight':2,'ingredients[3].unit':'lon',
  'importPayloadTemplate.ingredients[3].ingredientName':'cà chua băm đóng hộp (loại 400g)','importPayloadTemplate.ingredients[3].weight':2,'importPayloadTemplate.ingredients[3].unit':'lon',
 },
181: {
  'ingredients[6].ingredientName':'tỏi bào nhuyễn','ingredients[6].unit':'tép',
  'importPayloadTemplate.ingredients[6].ingredientName':'tỏi bào nhuyễn','importPayloadTemplate.ingredients[6].unit':'tép',
 },
185: {
  'ingredients[4].ingredientName':'tỏi thái lát','ingredients[4].unit':'tép',
  'importPayloadTemplate.ingredients[4].ingredientName':'tỏi thái lát','importPayloadTemplate.ingredients[4].unit':'tép',
 },
190: {
  'ingredients[2].ingredientName':'tỏi băm nhuyễn','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi băm nhuyễn','importPayloadTemplate.ingredients[2].unit':'tép',
 },
191: {
  'ingredients[0].ingredientName':'tỏi đập dập','ingredients[0].unit':'tép',
  'importPayloadTemplate.ingredients[0].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[0].unit':'tép',
  'ingredients[1].ingredientName':'cà chua băm đóng hộp',
  'importPayloadTemplate.ingredients[1].ingredientName':'cà chua băm đóng hộp',
  'ingredients[3].ingredientName':'dầu ô liu, thêm một ít để rưới',
  'importPayloadTemplate.ingredients[3].ingredientName':'dầu ô liu, thêm một ít để rưới',
 },
192: {
  'ingredients[1].ingredientName':'tỏi bổ dọc làm tư','ingredients[1].unit':'tép',
  'importPayloadTemplate.ingredients[1].ingredientName':'tỏi bổ dọc làm tư','importPayloadTemplate.ingredients[1].unit':'tép',
 },
195: {
  'ingredients[2].ingredientName':'tỏi đập dập','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[2].unit':'tép',
  'ingredients[5].ingredientName':'nước cốt dừa đóng hộp',
  'importPayloadTemplate.ingredients[5].ingredientName':'nước cốt dừa đóng hộp',
  'ingredients[10].ingredientName':'dầu ớt, thêm một ít để rưới khi dùng',
  'importPayloadTemplate.ingredients[10].ingredientName':'dầu ớt, thêm một ít để rưới khi dùng',
 },
197: {
  'ingredients[2].ingredientName':'tỏi đập dập','ingredients[2].unit':'tép',
  'importPayloadTemplate.ingredients[2].ingredientName':'tỏi đập dập','importPayloadTemplate.ingredients[2].unit':'tép',
 },
200: {
  'cookingSteps[1].content':'Đập trứng ra một cốc hoặc ly nhỏ, rồi nhẹ nhàng trượt từng quả vào phần nước trong các ramekin. Đặt lại vào nồi chiên không dầu và nấu ở 180C trong 5-8 phút đến khi lòng đỏ đạt độ chín mong muốn (mỗi nồi có thể chênh lệch thời gian).',
  'importPayloadTemplate.cookingSteps[1].content':'Đập trứng ra một cốc hoặc ly nhỏ, rồi nhẹ nhàng trượt từng quả vào phần nước trong các ramekin. Đặt lại vào nồi chiên không dầu và nấu ở 180C trong 5-8 phút đến khi lòng đỏ đạt độ chín mong muốn (mỗi nồi có thể chênh lệch thời gian).'
 }
}

for idx, ch in extra.items():
    entries.setdefault(idx,{})
    entries[idx].update(ch)

for idx, ch in extra.items():
    txt=' '.join(ch.keys())+' '+ ' '.join(str(v) for v in ch.values())
    if 'ingredients[' in txt and ('tỏi' in txt or 'tép' in txt or 'củ' in txt):
        reasons[idx].append('Sửa sai nghĩa clove (garlic): đinh hương -> tỏi, đồng bộ unit -> tép/củ theo EN.')
    if 'đóng hộp' in txt or 'có thể' in txt:
        reasons[idx].append('Sửa lỗi dịch máy từ "can" (đóng hộp) thành "có thể".')
    if 'rưới' in txt or 'mưa phùn' in txt:
        reasons[idx].append('Sửa literal "mưa phùn" -> "rưới" trong ngữ cảnh nấu ăn.')
    if 'cookingSteps' in txt:
        reasons[idx].append('Sửa câu hướng dẫn nấu bị sai nghĩa nghiêm trọng theo EN.')

for idx in [104,105,110,123,126,127,138,139,142,143,144,145,153,154,159,160,166,169,175,178,180,185,186,191,193,197,199]:
    reasons[idx].append('Sửa tên món sai nghĩa/literal theo EN (giữ proper noun khi cần).')

final=[]
for idx in sorted(entries):
    rs=[]
    seen=set()
    for r in reasons[idx]:
        r=r.strip()
        if r and r not in seen:
            seen.add(r)
            rs.append(r)
    final.append({'index': idx, 'changes': entries[idx], 'reason': ' '.join(rs)})

with open(out_patch,'w') as f:
    json.dump(final,f,ensure_ascii=False,indent=2)

cats=Counter()
for p in final:
    r=p['reason'].lower()
    if 'clove (garlic)' in r: cats['garlic_clove_mistranslation'] +=1
    if '"can"' in r: cats['can_literal_fix'] +=1
    if 'mưa phùn' in r or 'rưới' in r: cats['drizzle_phrase_fix'] +=1
    if 'tên món' in r: cats['recipe_name_fix'] +=1
    if 'hướng dẫn nấu' in r: cats['cooking_step_fix'] +=1

summary={
  'batch':'101-200',
  'totalRecipesReviewed':100,
  'totalFinalPatches':len(final),
  'coverage':{
    'recipeName': 27,
    'ingredients': 29,
    'cookingSteps': 2,
    'tags': 0
  },
  'categories': dict(cats),
  'indicesPatched':[p['index'] for p in final],
  'ruleApplied':'Theo rule batch 1 + rà soát EN↔VI cực kỹ: ưu tiên lỗi sai nghĩa rõ ràng (đặc biệt clove/garlic, can, drizzle), literal thô, tên món lệch nghĩa; giữ tên riêng/thuật ngữ ẩm thực khi cần.',
  'note':'Chỉ tạo final patch đề xuất; KHÔNG sửa trực tiếp dataset chính.'
}
with open(out_summary,'w') as f:
    json.dump(summary,f,ensure_ascii=False,indent=2)

print('WROTE', out_patch)
print('WROTE', out_summary)
print('TOTAL_PATCHED_RECIPES', len(final))
