// about页面图片的相对路径
// Store the relative path of the image
const cyclingImgs = [
    '../assets/images/cycling/myRoadBike3.jpeg', 
    '../assets/images/cycling/myRoadBike.jpg', 
    '../assets/images/cycling/myRoadBike2.jpeg', 
    '../assets/images/cycling/myRoadBike4.jpg', 
    '../assets/images/cycling/myRoadBike3.jpeg',
    '../assets/images/cycling/myMTB.jpg',
    '../assets/images/cycling/sundayRide.jpg',
    '../assets/images/cycling/sunnyDay.jpg'
    ];
const travellingImgs = [
    '../assets/images/travelling/singapore.jpg',
    '../assets/images/travelling/ntu.jpg',
    '../assets/images/travelling/army.jpg',
    '../assets/images/travelling/chongqing.jpg',
    '../assets/images/travelling/dali.jpg',
    '../assets/images/travelling/hotPot.jpg',
    '../assets/images/travelling/theGreatWall.jpg',
    '../assets/images/travelling/xian.jpg',
    '../assets/images/travelling/xinjiang.jpg'
];
const hikingImgs = [
    '../assets/images/hiking/climb.jpg',
    '../assets/images/hiking/hikeWithFriends.jpg',
    '../assets/images/hiking/hikeWithFriends2.jpg',
    '../assets/images/hiking/camp.jpg',
    '../assets/images/hiking/group.jpeg',
    '../assets/images/hiking/siguniang.jpg',
    '../assets/images/hiking/meadow.jpg',
    '../assets/images/hiking/snowPeak.jpg',
    '../assets/images/hiking/Mt.Wugong.jpg',
    '../assets/images/hiking/seaOfClouds.jpg',
];
const photographing = [
    '../assets/images/photographing/ragdoll.jpg',
    '../assets/images/photographing/sunrise.jpg',
    '../assets/images/photographing/diamondDust.jpg',
    '../assets/images/photographing/bottleTree.jpg',
    '../assets/images/photographing/GuiLin.jpg',
    '../assets/images/photographing/HongKong.jpg',
    '../assets/images/photographing/mitsubishi.jpg',
    '../assets/images/photographing/audi.jpg'
];
let cIndex = 0;
let tIndex = 0;
let hIndex = 0;
let pIndex = 0;

// 点击切换至下一张图片
// Show next image when the next button is clicked
function nextCycImg() {
    cIndex = (cIndex + 1) % cyclingImgs.length;
    document.getElementById('cyclingImg').src = cyclingImgs[cIndex];
}

function nextTraImg() {
    tIndex = (tIndex + 1) % travellingImgs.length;
    document.getElementById('travellingImg').src = travellingImgs[tIndex];
}

function nextHikImg() {
    hIndex = (hIndex + 1) % hikingImgs.length;
    document.getElementById('hikingImg').src = hikingImgs[hIndex];
}

function nextPhoImg() {
    pIndex = (pIndex + 1) % photographing.length;
    document.getElementById('photographingImg').src = photographing[pIndex];
}