# 停车控制系统

![](https://user-images.githubusercontent.com/66936909/94420163-57952580-01b6-11eb-87ec-3f866b383e24.png)

安全、高效、可定制的智慧停车解决方案，全套开源

## 本项目一共分为 5 端 可根据实际情况选择是否使用

1. 服务端 https://github.com/ddhmit/parking-control-server
2. APP 端 https://github.com/ddhmit/parking-control-app
3. 管理端 https://github.com/ddhmit/parking-control-admin
4. 小票端 https://github.com/ddhmit/parking-control-ticket
5. 微信扫码支付预览 https://github.com/ddhmit/parking-control-wxpay

## 特性

1. ⛲ 科学计费 多种计费方案灵活切换，商场、小区、停车场等场景均适用
2. ⏲ 商户放行 配套商户 APP 可由商户控制经停车辆放行，加强市场安全
3. ♉ 无人值守 云端控制实现无岗亭模式下的车辆自主进出，降低人工成本
4. ⛳ 应急开闸 在意外突发情况下，管理员无需到场可随时远程进行开闸放行
5. 🍓 强兼容性 不更换原有抓拍机，可兼容市面上 90%的抓拍机品牌
6. 📱 移动支付 直接使用微信支付宝等扫码支付，无需人工干预提升效率
7. 🎫 电子小票 三轮车等无牌车可采用领取小票方式入场，全流程无缝衔接
8. ⏳ 经停追踪 搭配商户 APP，可随时调阅车辆经停记录，确保装卸货万无一失
9. 🙋 人像识别 智能人像识别系统，确保小区业主通行无阻，保障小区安全

## 技术架构

该系统服务端理论上兼容全平台，目前我们在生产环境中是在 ubuntu 上使用 docker 部署的
该套系统采用 web 全栈解决方案，服务端 node.js，APP ionic，管理端 react
但还包括 docker，eggjs，redis，mongodb，socket.io，typescript，微信支付等技术细节

## 使用

### 服务端部署方法

省略 ubuntu 上安装 docker 的步骤
仅演示 ubuntu 上的服务端部署

1. `cd ../srv`
2. `git clone https://github.com/ddhmit/parking-control-server.git`
3. `docker network create net-1`
4. `docker run -ti -p 7002:7002 --name parkserver --network net-1 --network-alias parkserver --restart always -v /srv/parking-control-server:/srv/parking-control-server -v /logs:/root/logs -v /etc/localtime:/etc/localtime:ro --privileged=true -d node sh -c 'cd /srv/parking-control-server && npm i && npm run start'`

### 前端

管理端、小票端、微信扫码支付预览 及 APP 打包部署
均使用以下方式

1. `npm i`
2. `npm run build`

## 截图

![](https://user-images.githubusercontent.com/66936909/94420486-ce322300-01b6-11eb-84af-fd1fdd81d565.png)
![](https://user-images.githubusercontent.com/66936909/94420774-37199b00-01b7-11eb-9d4c-8e4753537067.png)
![](https://user-images.githubusercontent.com/66936909/94421786-a80d8280-01b8-11eb-8b03-4a5dceefcd4d.png)
