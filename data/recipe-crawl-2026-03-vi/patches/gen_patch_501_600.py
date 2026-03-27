import json,re,os
from copy import deepcopy

en_path='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03/recipes.json'
vi_path='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/recipes.vi.json'
patch_path='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/patches/patch_501_600.json'
summary_path='/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi/patches/summary_501_600.json'

en=json.load(open(en_path))
vi=json.load(open(vi_path))

start,end=501,600

unit_map={
    'tbsp':'muỗng canh','tsp':'muỗng cà phê','g':'g','kg':'kg','ml':'ml','l':'l','cm':'cm','oz':'oz','lb':'lb','lbs':'lb','fl':'fl oz',
    'cup':'cốc','cups':'cốc'
}

prefix_units=['nhánh','củ','thanh','bó','tép','lá','quả','miếng','lát','cọng','muỗng','thìa','gói','hộp','ly','nắm','nhúm','cái','vài']
prep_patterns=[
    r'\s*\(.*?\)',r'\s*để (?:phục vụ|trang trí|dùng|ăn kèm).*$',r'\s*để rắc.*$',r'\s*cộng thêm.*$',
    r'\s*(?:thái|cắt|băm|bào|nghiền|xay|đập dập|đập|bóc vỏ|gọt|rửa|nướng|luộc|chiên|áp chảo|nấu chín|làm mềm|đánh tan|đánh bông|xé nhỏ|tách).*$',
]

bad_literal={
 'đinh hương':'tỏi', 'thanh niên':'húng tây', 'lá cây':'lá nguyệt quế','đại khái':'hành tây','bóng đèn':'thì là tây',
 'vỏ quả bị':'bạch đậu khấu','chủ đề':'nhụy nghệ tây','cây hồi':'hoa hồi','gậy':'quế','rình rập':'sả',
 'nắp ca-pô đã được':'ớt scotch bonnet','choi giảm một nửa':'cải thìa','choi tứ quý':'cải thìa'
}

def frac_to_float(s):
    s=s.strip()
    m=re.match(r'^(\d+)\s*([¼½¾])$',s)
    if m:
        base=int(m.group(1));f={'¼':0.25,'½':0.5,'¾':0.75}[m.group(2)];return base+f
    if s in {'¼','½','¾'}: return {'¼':0.25,'½':0.5,'¾':0.75}[s]
    if re.match(r'^\d+\/\d+$',s):
        a,b=s.split('/');return round(int(a)/int(b),3)
    try:return float(s)
    except:return None

def infer_weight(raw,cur):
    raw=raw.replace('–','-')
    pats=[r'(\d+\s*[¼½¾])\s*(?:tbsp|tsp)',r'([¼½¾])\s*(?:tbsp|tsp)',r'(\d+\/\d+)\s*(?:tbsp|tsp)']
    for p in pats:
        m=re.search(p,raw)
        if m:
            v=frac_to_float(m.group(1))
            if v is not None:return v
    return cur

def infer_unit(raw,cur_unit):
    r=' '+raw.lower()+' '
    for k,v in unit_map.items():
        if f' {k} ' in r:
            return v
    if ' garlic clove' in r or (' cloves' in r and 'garlic' in r): return 'tép'
    if ' sprig' in r: return 'nhánh'
    if ' stick' in r and 'cinnamon' in r: return 'thanh'
    if ' leaf' in r or ' leaves' in r: return 'lá'
    if ' bunch' in r: return 'bó'
    if ' handful' in r: return 'nắm'
    if ' pinch' in r: return 'nhúm'
    if ' rasher' in r: return 'lát'
    if ' fillet' in r or ' fillets' in r: return 'phi lê'
    if ' slice' in r or ' slices' in r: return 'lát'
    if ' pack ' in r: return 'gói'
    if ' sachet' in r: return 'gói'
    if ' glass' in r: return 'ly'
    if ' pod' in r or ' pods' in r: return 'quả'
    if ' egg' in r or ' eggs' in r: return 'quả'
    if any(x in r for x in [' onion',' shallot',' potato',' carrot',' garlic bulb',' leek','celery stick']):
        if 'celery stick' in r: return 'thanh'
        return 'củ'
    if any(x in r for x in [' lemon',' lime',' orange',' apple',' pear',' tomato',' pepper',' chilli',' aubergine',' courgette',' avocado',' cucumber',' peach','plum']):
        return 'quả'
    if any(x in r for x in [' sausage',' doughnut',' cookie',' pretzel',' tortilla',' baguette',' flatbread','breadstick','croissant']):
        return 'cái'
    if cur_unit!='đơn vị':
        return cur_unit
    return 'cái'

def clean_name(name):
    n=(name or '').strip()
    if n in bad_literal: return bad_literal[n]
    n=re.sub(r'^(?:một|nửa|½|¼|vài|ít|\d+[\d\./,]*)\s+','',n,flags=re.I)
    n=re.sub(r'^(?:'+'|'.join(prefix_units)+r')\s+','',n,flags=re.I)
    n=re.sub(r'^(?:'+'|'.join(prefix_units)+r')\s+','',n,flags=re.I)
    for p in prep_patterns:
        n=re.sub(p,'',n,flags=re.I)
    n=n.strip(' ,.-')
    return n

def infer_name(raw,cur):
    r=' '+raw.lower()+' '
    if 'garlic' in r: return 'tỏi'
    if 'spring onion' in r or 'spring onions' in r: return 'hành lá'
    if 'shallot' in r: return 'hành tím'
    if 'red onion' in r: return 'hành đỏ'
    if 'onion' in r: return 'hành tây'
    if 'bay leaf' in r or (' leaf ' in r and ' bay ' in r): return 'lá nguyệt quế'
    if 'curry leaves' in r: return 'lá cà ri'
    if 'sage' in r: return 'xô thơm'
    if 'thyme' in r: return 'húng tây'
    if 'rosemary' in r: return 'hương thảo'
    if 'lemongrass' in r: return 'sả'
    if 'coriander' in r: return 'rau mùi'
    if 'parsley' in r: return 'mùi tây'
    if 'mint' in r: return 'bạc hà'
    if 'dill' in r: return 'thì là'
    if 'chives' in r: return 'hẹ tây'
    if 'cinnamon' in r: return 'quế'
    if 'star anise' in r or ('anise' in r and 'star' in r): return 'hoa hồi'
    if 'cardamom' in r: return 'bạch đậu khấu'
    if 'fennel' in r: return 'thì là tây'
    if 'egg' in r: return 'trứng'
    if 'lemon' in r: return 'chanh vàng'
    if 'lime' in r: return 'chanh xanh'
    if 'orange' in r: return 'cam'
    if 'carrot' in r: return 'cà rốt'
    if 'potato' in r: return 'khoai tây'
    if 'tomato' in r: return 'cà chua'
    if 'aubergine' in r: return 'cà tím'
    if 'courgette' in r: return 'bí ngòi'
    if 'cucumber' in r: return 'dưa chuột'
    if 'pepper' in r and 'romano' in r: return 'ớt romano'
    if 'pepper' in r: return 'ớt chuông'
    if 'chilli' in r: return 'ớt'
    if 'apple' in r: return 'táo'
    if 'pear' in r: return 'lê'
    if 'plum' in r: return 'mận'
    if 'peach' in r: return 'đào'
    if 'avocado' in r: return 'bơ'
    if 'sausage' in r: return 'xúc xích'
    if 'bacon' in r: return 'thịt xông khói'
    if 'fillet' in r and 'chicken' in r: return 'phi lê gà'
    if 'chicken thigh' in r or ('thigh' in r and 'chicken' in r): return 'đùi gà'
    if 'chicken breast' in r: return 'ức gà'
    if 'lamb shank' in r or ('shank' in r and 'lamb' in r): return 'bắp cừu'
    if 'lamb leg' in r: return 'đùi cừu'
    if 'cod' in r: return 'cá tuyết'
    if 'hake' in r: return 'cá hake'
    if 'sea bass' in r or 'bass fillet' in r: return 'cá vược'
    if 'trout' in r: return 'cá hồi suối'
    if 'salmon' in r: return 'cá hồi'
    if 'blueberr' in r: return 'việt quất'
    if 'raspberr' in r: return 'mâm xôi'
    if 'blackberr' in r: return 'mâm xôi đen'
    if 'pistachio' in r: return 'hạt dẻ cười'
    if 'walnut' in r: return 'óc chó'
    if 'hazelnut' in r: return 'hạt phỉ'
    if 'sesame seed' in r: return 'mè'
    if 'sesame oil' in r: return 'dầu mè'
    if 'stock' in r: return 'nước dùng'
    if 'bread' in r or 'baguette' in r or 'sourdough' in r: return 'bánh mì'
    if 'tortilla' in r: return 'bánh tortilla'
    if 'flatbread' in r: return 'bánh mì dẹt'
    if 'pretzel' in r: return 'bánh pretzel'
    if 'cookie' in r or 'oreo' in r: return 'bánh quy'
    if 'doughnut' in r: return 'bánh donut'
    if 'ice' in r and len(r.split())<5: return 'đá'
    c=clean_name(cur)
    if c: return c
    t=re.sub(r'\([^)]*\)','',raw.lower())
    t=re.sub(r'\b(?:to serve|optional|finely|roughly|chopped|sliced|diced|peeled|halved|quartered|crushed|grated|beaten|juiced|zested|picked|fresh|dried|large|small|medium|leftover)\b','',t)
    t=' '.join(t.split())
    return t[:60].strip() or (cur or '').strip()

patch=[]
by_recipe={}
changed_fields={'weight':0,'unit':0,'ingredientName':0}

for ridx in range(start-1,end):
    r_en=en[ridx]; r_vi=vi[ridx]
    en_ings=r_en.get('ingredients',[]); vi_ings=r_vi.get('ingredients',[])
    maxlen=min(len(en_ings),len(vi_ings))
    for j in range(maxlen):
        eing=en_ings[j]; ving=vi_ings[j]
        raw=f"{eing.get('weight','')} {eing.get('unit','')} {eing.get('ingredientName','')}"
        new=deepcopy(ving)
        reasons=[]

        target_unit=infer_unit(raw, (ving.get('unit') or '').strip().lower())
        if (ving.get('unit') or '').strip().lower()=='đơn vị' or (target_unit and target_unit!=(ving.get('unit') or '')):
            if target_unit and target_unit!=(ving.get('unit') or ''):
                new['unit']=target_unit; reasons.append('Chuẩn hóa đơn vị đếm/đo từ EN, thay "đơn vị" bằng đơn vị phù hợp.')

        nw=infer_weight(raw,new.get('weight'))
        if isinstance(nw,(int,float)) and nw!=new.get('weight'):
            new['weight']=nw; reasons.append('Chuẩn hóa quantity -> weight theo phân số/số lượng trong EN.')

        cur_name=(ving.get('ingredientName') or '').strip()
        cleaned=clean_name(cur_name)
        need_name_change=False
        if cleaned!=cur_name and cleaned:
            need_name_change=True
        if cur_name in bad_literal or re.search(r'\b(để phục vụ|để trang trí|nướng|băm|thái|cắt|đập|xắt|giảm một nửa|đại khái)\b',cur_name.lower()) or re.match(r'^(?:'+'|'.join(prefix_units)+r')\b',cur_name.lower()):
            need_name_change=True
        if need_name_change:
            target_name=infer_name(raw,cur_name)
            if target_name and target_name!=cur_name:
                new['ingredientName']=target_name
                reasons.append('Chuẩn hóa ingredientName: chỉ giữ tên nguyên liệu, bỏ tiền tố đơn vị/prep-step.')

        if new!=ving:
            diff_fields=[k for k in ['ingredientName','weight','unit','isMain','isCommon'] if new.get(k)!=ving.get(k)]
            for f in diff_fields:
                if f in changed_fields: changed_fields[f]+=1
            rec_idx=ridx+1
            patch.append({
                'recipeIndex':rec_idx,
                'ingredientIndex':j+1,
                'new':new,
                'reason':' '.join(dict.fromkeys(reasons)) if reasons else 'Chuẩn hóa theo đối chiếu EN-VI.'
            })
            by_recipe[rec_idx]=by_recipe.get(rec_idx,0)+1

os.makedirs(os.path.dirname(patch_path),exist_ok=True)
json.dump(patch,open(patch_path,'w'),ensure_ascii=False,indent=2)
summary={
    'range':{'start':start,'end':end,'count':end-start+1},
    'totalPatches':len(patch),
    'recipesWithChanges':len(by_recipe),
    'changedFields':changed_fields,
    'topRecipesByPatchCount':sorted(([{'recipeIndex':k,'patchCount':v} for k,v in by_recipe.items()]), key=lambda x:x['patchCount'], reverse=True)[:20]
}
json.dump(summary,open(summary_path,'w'),ensure_ascii=False,indent=2)
print('patches',len(patch),'recipes',len(by_recipe))
print('wrote',patch_path)
print('wrote',summary_path)
