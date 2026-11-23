# 人宠肖像风格库

共 115 个独立风格文件：90 个人宠合照、25 个仅宠物肖像。

## 文件结构

- 每个 `<id>.ts` 保存稳定 ID、中英文名称、场景与姿势描述、主角类型、分类、版本、验证状态和画幅。
- `index.ts` 显式导入全部风格；新增风格时同步登记。
- 上层 `catalog.ts` 统一身份保真、参考图顺序、解剖结构、动物舒适度和无拼贴规则，与独立场景描述合成完整提示词。修改公共规则会影响所有风格。

## 验证边界

所有配置当前标为 `draft`：已做结构、唯一性、参考图顺序、预览上限与 SQL 白名单检查，尚未逐项付费出图或生成缩略图。115 是可选择配置数量，不表示 115 种视觉效果已通过实测。当前都是写实摄影的场景、构图与光影变化。

人宠合照限定 1 人＋1 宠物；仅宠物限定 1 宠物。尚未支持多人家庭或多宠物参考图。独立文件提供中文和英文名称，新增风格在西班牙语和法语页面暂用英文名。

## 使用与维护

1. 修改某个风格的 `setting`，提升 `version`；已售图片依赖稳定 ID，避免修改或复用 ID。
2. 新增风格后更新 `index.ts`、页面数量及数据库白名单迁移，执行目录测试和 TypeScript 检查。
3. 出图验收至少检查：身份一致、宠物花纹、人物手部、主体数量、接触姿势、统一光影与画幅；记录使用模型、样本、日期及失败案例后再改变验证状态。
4. 页面先选择人宠合照或仅宠物，再按类别选择首选场景。每位访客保留 3 张预览额度；其余预览保持相同主角类型，不会自动生成整个目录。
5. 上线前按顺序应用 commerce 迁移和 `20261123182840_expand_pet_portrait_catalog.sql`；后者扩展 attempts、jobs、order_items 三张表的场景白名单，保留全局日限额并新增访客 3 张硬限制。预留失败记录同样占额度；同时应用 `20261123182852_harden_pet_portrait_lifecycle.sql`；仅明确拒绝或已保存结果的交付失败允许有限重试，扣费结果不明时需人工核查。模式切换允许更换参考图，仍共享访客额度。

## 风格清单

| ID | 中文名称 | English | 主角 | 分类 |
| --- | --- | --- | --- | --- |
| [studio](./studio.ts) | 影棚拥抱 | Studio embrace | 人宠合照 | 影棚 |
| [ivory-profile](./ivory-profile.ts) | 奶油侧影 | Ivory profiles | 人宠合照 | 影棚 |
| [charcoal-close](./charcoal-close.ts) | 炭灰依偎 | Charcoal closeness | 人宠合照 | 影棚 |
| [window-silhouette](./window-silhouette.ts) | 窗边轮廓 | Window outline | 人宠合照 | 影棚 |
| [sandstone-seat](./sandstone-seat.ts) | 砂岩色坐像 | Sandstone seat | 人宠合照 | 影棚 |
| [blue-hour-studio](./blue-hour-studio.ts) | 蓝调影棚 | Blue hour studio | 人宠合照 | 影棚 |
| [rose-shoulder](./rose-shoulder.ts) | 玫瑰色肩头 | Rose shoulder | 人宠合照 | 影棚 |
| [rust-linen](./rust-linen.ts) | 陶土与亚麻 | Rust and linen | 人宠合照 | 影棚 |
| [monochrome-bond](./monochrome-bond.ts) | 黑白默契 | Monochrome bond | 人宠合照 | 影棚 |
| [high-key-duo](./high-key-duo.ts) | 明亮双人像 | Airy duo | 人宠合照 | 影棚 |
| [low-key-duo](./low-key-duo.ts) | 静谧明暗 | Quiet chiaroscuro | 人宠合照 | 影棚 |
| [olive-bench](./olive-bench.ts) | 橄榄绿长椅 | Olive bench | 人宠合照 | 影棚 |
| [pearl-curtain](./pearl-curtain.ts) | 珍珠色帘幕 | Pearl curtain | 人宠合照 | 影棚 |
| [floor-level](./floor-level.ts) | 平视陪伴 | At their height | 人宠合照 | 影棚 |
| [hands-under-chin](./hands-under-chin.ts) | 下巴与脸颊 | Chin and cheek | 人宠合照 | 影棚 |
| [wide-negative-space](./wide-negative-space.ts) | 留白合照 | Room to breathe | 人宠合照 | 影棚 |
| [round-pool-light](./round-pool-light.ts) | 圆光之中 | Circle of light | 人宠合照 | 影棚 |
| [linen-plinth](./linen-plinth.ts) | 亚麻台座 | Linen pedestal | 人宠合照 | 影棚 |
| [soft-flash](./soft-flash.ts) | 柔闪记忆 | Soft flash memory | 人宠合照 | 影棚 |
| [museum-portrait](./museum-portrait.ts) | 画廊肖像 | Gallery portrait | 人宠合照 | 影棚 |
| [home](./home.ts) | 慵懒清晨 | Slow morning | 人宠合照 | 温馨居家 |
| [breakfast-nook](./breakfast-nook.ts) | 早餐角落 | Breakfast nook | 人宠合照 | 温馨居家 |
| [rainy-reading](./rainy-reading.ts) | 雨天共读 | Rainy reading | 人宠合照 | 温馨居家 |
| [bedside-sunrise](./bedside-sunrise.ts) | 床边晨光 | Bedside sunrise | 人宠合照 | 温馨居家 |
| [knitted-evening](./knitted-evening.ts) | 针织夜晚 | Knitted evening | 人宠合照 | 温馨居家 |
| [attic-window](./attic-window.ts) | 阁楼天光 | Attic daylight | 人宠合照 | 温馨居家 |
| [record-listening](./record-listening.ts) | 唱片午后 | Record afternoon | 人宠合照 | 温馨居家 |
| [fireside-rug](./fireside-rug.ts) | 炉边地毯 | Fireside rug | 人宠合照 | 温馨居家 |
| [balcony-coffee](./balcony-coffee.ts) | 阳台清晨 | Balcony morning | 人宠合照 | 温馨居家 |
| [kitchen-stool](./kitchen-stool.ts) | 厨房伙伴 | Kitchen companion | 人宠合照 | 温馨居家 |
| [doorway-welcome](./doorway-welcome.ts) | 玄关迎接 | Homecoming | 人宠合照 | 温馨居家 |
| [laundry-day](./laundry-day.ts) | 洗衣午后 | Laundry afternoon | 人宠合照 | 温馨居家 |
| [winter-window](./winter-window.ts) | 冬日窗边 | Winter indoors | 人宠合照 | 温馨居家 |
| [tea-break](./tea-break.ts) | 一起茶歇 | Tea break together | 人宠合照 | 温馨居家 |
| [sunroom-siesta](./sunroom-siesta.ts) | 日光房小憩 | Sunroom pause | 人宠合照 | 温馨居家 |
| [hallway-mirror](./hallway-mirror.ts) | 走廊合影 | Hallway portrait | 人宠合照 | 温馨居家 |
| [quilted-morning](./quilted-morning.ts) | 拼布清晨 | Patchwork morning | 人宠合照 | 温馨居家 |
| [bookcase-corner](./bookcase-corner.ts) | 书架角落 | Bookcase corner | 人宠合照 | 温馨居家 |
| [curtain-breeze](./curtain-breeze.ts) | 微风纱帘 | Curtain breeze | 人宠合照 | 温馨居家 |
| [quiet-sunday](./quiet-sunday.ts) | 周日小憩 | Sunday pause | 人宠合照 | 温馨居家 |
| [studio-apartment](./studio-apartment.ts) | 小屋相伴 | Little apartment | 人宠合照 | 温馨居家 |
| [porch-rocker](./porch-rocker.ts) | 门廊摇椅 | Porch rocker | 人宠合照 | 温馨居家 |
| [bay-window](./bay-window.ts) | 飘窗陪伴 | Bay window company | 人宠合照 | 温馨居家 |
| [candle-glow](./candle-glow.ts) | 灯下夜晚 | Lamplight evening | 人宠合照 | 温馨居家 |
| [moving-day](./moving-day.ts) | 新家时刻 | New home moment | 人宠合照 | 温馨居家 |
| [coast](./coast.ts) | 金色海岸 | Golden coast | 人宠合照 | 户外 |
| [orchard-walk](./orchard-walk.ts) | 果园小径 | Orchard path | 人宠合照 | 户外 |
| [pine-trail](./pine-trail.ts) | 松林小路 | Pine trail | 人宠合照 | 户外 |
| [lake-pier](./lake-pier.ts) | 湖畔停留 | Lakeside pause | 人宠合照 | 户外 |
| [meadow-dawn](./meadow-dawn.ts) | 草甸晨曦 | Meadow dawn | 人宠合照 | 户外 |
| [urban-garden](./urban-garden.ts) | 城市花园 | City garden | 人宠合照 | 户外 |
| [desert-evening](./desert-evening.ts) | 沙漠暮色 | Desert evening | 人宠合照 | 户外 |
| [snowy-cabin](./snowy-cabin.ts) | 雪屋门前 | Snow cabin greeting | 人宠合照 | 户外 |
| [lavender-path](./lavender-path.ts) | 薰衣草小径 | Lavender path | 人宠合照 | 户外 |
| [sunflower-lane](./sunflower-lane.ts) | 向日葵小路 | Sunflower lane | 人宠合照 | 户外 |
| [rose-courtyard](./rose-courtyard.ts) | 蔷薇庭院 | Rose courtyard | 人宠合照 | 户外 |
| [olive-shade](./olive-shade.ts) | 橄榄树荫 | Olive shade | 人宠合照 | 户外 |
| [mountain-view](./mountain-view.ts) | 山间清晨 | Mountain morning | 人宠合照 | 户外 |
| [river-stones](./river-stones.ts) | 河岸记忆 | Riverbank memory | 人宠合照 | 户外 |
| [botanical-arch](./botanical-arch.ts) | 花园拱门 | Garden arch | 人宠合照 | 户外 |
| [cherry-lane](./cherry-lane.ts) | 樱花小径 | Blossom lane | 人宠合照 | 户外 |
| [autumn-bench](./autumn-bench.ts) | 秋日长椅 | Autumn bench | 人宠合照 | 户外 |
| [seaside-boardwalk](./seaside-boardwalk.ts) | 海风栈道 | Sea breeze walk | 人宠合照 | 户外 |
| [countryside-gate](./countryside-gate.ts) | 乡间木门 | Countryside gate | 人宠合照 | 户外 |
| [fern-path](./fern-path.ts) | 蕨林小径 | Fern trail | 人宠合照 | 户外 |
| [rainy-arcade](./rainy-arcade.ts) | 雨檐之下 | Rain shelter | 人宠合照 | 户外 |
| [wild-grass](./wild-grass.ts) | 芒草黄昏 | Wild grass evening | 人宠合照 | 户外 |
| [island-garden](./island-garden.ts) | 海岛花园 | Island garden | 人宠合照 | 户外 |
| [stone-bridge](./stone-bridge.ts) | 古桥合影 | Old bridge portrait | 人宠合照 | 户外 |
| [heather-hill](./heather-hill.ts) | 石楠山坡 | Heather hillside | 人宠合照 | 户外 |
| [matching-scarves](./matching-scarves.ts) | 同色围巾 | Matching scarves | 人宠合照 | 趣味生活 |
| [birthday-pair](./birthday-pair.ts) | 一起过生日 | Birthday together | 人宠合照 | 趣味生活 |
| [picnic-partners](./picnic-partners.ts) | 野餐搭档 | Picnic partners | 人宠合照 | 趣味生活 |
| [camping-door](./camping-door.ts) | 帐篷伙伴 | Tent companions | 人宠合照 | 趣味生活 |
| [cafe-table](./cafe-table.ts) | 咖啡搭子 | Café company | 人宠合照 | 趣味生活 |
| [vinyl-duo](./vinyl-duo.ts) | 唱片封面合照 | Debut duo | 人宠合照 | 趣味生活 |
| [photo-booth-duo](./photo-booth-duo.ts) | 拍照亭笑脸 | Booth smiles | 人宠合照 | 趣味生活 |
| [paint-break](./paint-break.ts) | 画室小憩 | Creative break | 人宠合照 | 趣味生活 |
| [garden-boots](./garden-boots.ts) | 园艺助手 | Garden helpers | 人宠合照 | 趣味生活 |
| [pillow-party](./pillow-party.ts) | 抱枕派对 | Pillow company | 人宠合照 | 趣味生活 |
| [roadtrip-stop](./roadtrip-stop.ts) | 公路旅行小站 | Road trip pause | 人宠合照 | 趣味生活 |
| [seaside-stripes](./seaside-stripes.ts) | 夏日条纹 | Summer stripes | 人宠合照 | 趣味生活 |
| [pumpkin-step](./pumpkin-step.ts) | 秋日门阶 | Autumn doorstep | 人宠合照 | 趣味生活 |
| [festive-sofa](./festive-sofa.ts) | 节日沙发 | Festive sofa | 人宠合照 | 趣味生活 |
| [new-year-duo](./new-year-duo.ts) | 新年合影 | A fresh year | 人宠合照 | 趣味生活 |
| [raincoat-pair](./raincoat-pair.ts) | 雨衣小队 | Raincoat rendezvous | 人宠合照 | 趣味生活 |
| [travel-postcard](./travel-postcard.ts) | 旅行明信片 | Postcard moment | 人宠合照 | 趣味生活 |
| [kite-meadow](./kite-meadow.ts) | 风筝午后 | Kite afternoon | 人宠合照 | 趣味生活 |
| [blanket-hideout](./blanket-hideout.ts) | 毛毯秘密基地 | Blanket hideout | 人宠合照 | 趣味生活 |
| [weekend-market](./weekend-market.ts) | 市集早晨 | Market morning | 人宠合照 | 趣味生活 |
| [pet-sage](./pet-sage.ts) | 鼠尾草绿独照 | Sage solo | 仅宠物 | 影棚 |
| [pet-ivory](./pet-ivory.ts) | 奶油色独照 | Ivory solo | 仅宠物 | 影棚 |
| [pet-charcoal](./pet-charcoal.ts) | 炭灰色独照 | Charcoal solo | 仅宠物 | 影棚 |
| [pet-blue](./pet-blue.ts) | 蓝色独照 | Blue solo | 仅宠物 | 影棚 |
| [pet-rose](./pet-rose.ts) | 玫瑰色独照 | Rose solo | 仅宠物 | 影棚 |
| [pet-terracotta](./pet-terracotta.ts) | 陶土色独照 | Terracotta solo | 仅宠物 | 影棚 |
| [pet-monochrome](./pet-monochrome.ts) | 黑白独照 | Monochrome solo | 仅宠物 | 影棚 |
| [pet-museum](./pet-museum.ts) | 画廊独照 | Gallery solo | 仅宠物 | 影棚 |
| [pet-white](./pet-white.ts) | 纯白独照 | Bright solo | 仅宠物 | 影棚 |
| [pet-profile](./pet-profile.ts) | 侧影肖像 | Profile study | 仅宠物 | 影棚 |
| [pet-window](./pet-window.ts) | 窗边暖意 | Window warmth | 仅宠物 | 温馨居家 |
| [pet-armchair](./pet-armchair.ts) | 最爱的扶手椅 | Favorite armchair | 仅宠物 | 温馨居家 |
| [pet-books](./pet-books.ts) | 书房独照 | Library companion | 仅宠物 | 温馨居家 |
| [pet-quilt](./pet-quilt.ts) | 拼布小窝 | Quilt nest | 仅宠物 | 温馨居家 |
| [pet-sunroom](./pet-sunroom.ts) | 日光房休憩 | Sunroom rest | 仅宠物 | 温馨居家 |
| [pet-meadow](./pet-meadow.ts) | 草甸独照 | Meadow solo | 仅宠物 | 户外 |
| [pet-forest](./pet-forest.ts) | 森林独照 | Forest solo | 仅宠物 | 户外 |
| [pet-garden](./pet-garden.ts) | 花园独照 | Garden solo | 仅宠物 | 户外 |
| [pet-coast](./pet-coast.ts) | 海岸独照 | Coastal solo | 仅宠物 | 户外 |
| [pet-autumn](./pet-autumn.ts) | 秋日独照 | Autumn solo | 仅宠物 | 户外 |
| [pet-picnic](./pet-picnic.ts) | 野餐来宾 | Picnic guest | 仅宠物 | 趣味生活 |
| [pet-birthday](./pet-birthday.ts) | 生日主角 | Birthday star | 仅宠物 | 趣味生活 |
| [pet-pumpkin](./pet-pumpkin.ts) | 南瓜伙伴 | Pumpkin companion | 仅宠物 | 趣味生活 |
| [pet-holiday](./pet-holiday.ts) | 节日微光 | Holiday glow | 仅宠物 | 趣味生活 |
| [pet-color](./pet-color.ts) | 缤纷主角 | Color pop | 仅宠物 | 趣味生活 |

## 完整提示词示例

### 影棚拥抱

Create one photorealistic vertical editorial portrait, aspect ratio 3:4, in sage-green studio, the person gently embracing the pet at chest height. Reference image 1 is the identity reference for the human; image 2 is the identity reference for their pet. Show exactly one person and one pet. Preserve the human's face shape, eyes, nose, skin tone, hair and apparent age. Keep both faces visible. Use anatomically plausible hands and believable contact. Preserve the pet's exact species, size, coat color, markings, ears and muzzle or beak. Adapt the pose to the referenced animal's anatomy and size; never change its species or force a large animal into a small-animal pose. Keep the animal comfortable, supported and away from hazards. Repose subjects naturally in one coherent photograph with shared light and perspective. Use references for likeness, not pose or background. Single continuous frame with realistic texture. No extra subjects, duplicate limbs, collage, partitions, pasted cutouts, text, borders or logos.

### 鼠尾草绿独照

Create one photorealistic vertical editorial portrait, aspect ratio 3:4, in sage-green seamless studio, relaxed seated pet at eye level. Reference image 1 is the identity reference for the pet. Show exactly one pet alone. No people, human faces, hands or other human body parts. Preserve the pet's exact species, size, coat color, markings, ears and muzzle or beak. Adapt the pose to the referenced animal's anatomy and size; never change its species or force a large animal into a small-animal pose. Keep the animal comfortable, supported and away from hazards. Repose subjects naturally in one coherent photograph with shared light and perspective. Use references for likeness, not pose or background. Single continuous frame with realistic texture. No extra subjects, duplicate limbs, collage, partitions, pasted cutouts, text, borders or logos.
