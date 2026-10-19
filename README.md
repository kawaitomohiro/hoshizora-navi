# 星空ナビ

小学生のための星座アプリです。いまの空に見える星座・星・惑星・月をさがせます。

**ひらく → https://kawaitomohiro.github.io/hoshizora-navi/**

- 小学校で学ぶ星座20・名前のある星18・星のならび（夏・冬・春の大三角、秋の四辺形、北斗七星）・惑星5つ・月をさがせる
- タブレットやスマホを空にかざすと、その方向の星が出る（方位センサー・GPS）。カメラの映像に重ねることもできる
- 時刻を動かして、星が東から南を通って西へ動くようす、北の空が北極星のまわりを回るようすを見られる
- 月の形と動き（3Dの模型と、これから30日の月の形）
- 20の星座に神話のすがたの絵。星座を選ぶと、その星座の絵が星に重なって出る
- 本物の空で見つけた星座のスタンプ帳、星座クイズ（「きほん」は4年・6年の理科で習うこと）
- 星座や月の説明から、科学館や教育委員会の解説動画（YouTube）へ
- iPad・Chromebook・スマホのブラウザで動く。インストール不要・ログイン不要
- 場所やスタンプは端末の中だけで使い、どこにも送らない

## 作り方

`src/` の部品を `python3 build.py` で1枚の `docs/index.html` にまとめています（GitHub Pages で配信）。
星のデータは `make_data.py` で `data_src/` から作り直せます。

## データとライセンス

- アプリ本体: MIT License（`LICENSE`）
- 星の位置・明るさ・色・星座の線: [d3-celestial](https://github.com/ofrohn/d3-celestial) のデータ。Copyright (c) 2015, Olaf Frohn. BSD 3-Clause License（`docs/LICENSE-d3-celestial.txt`）
- 惑星: NASA JPL の惑星の軌道の数字（Keplerian Elements for Approximate Positions of the Major Planets）から計算
- 星座の絵: 画像生成AI（GPT Image）で作った線画を、本物の星の位置に合わせて重ねたもの（`src/art/`）
- 3D表示: [three.js](https://threejs.org/)（MIT License、CDNから読み込み）
