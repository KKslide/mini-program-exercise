//获取应用实例
const app = getApp()
const WxParse = require("../../../utils/wxParse/wxParse");
const util = require("../../../utils/util");

Page({
	data: {
		userInfo: {},
		content: null,
		// title:"", // 文章标题
		// content: "", // 文章内容
		// category:"", // 文章分类
		// categoryImg:"", // 文章分类缩略图
		// poster: "http://example.kkslide.fun/upload_f5775b20fce5d152445eb50f0020c4a4", // 文章封面
		// videoSrc: "http://example.kkslide.fun/trip-in-guilin_v2.mp4", // 文章视频链接
		textAreaFocus: false, // 文本框聚焦
		comment: "", // 评论内容
	},
	commentHandler(e) { // 点击评论的时候-跳转至输入框
		this.setData({
			textAreaFocus: true
		});
		wx.pageScrollTo({
			duration: 300,
			selector: "#comment"
		})
	},
	blurHandler(e) { // 失去焦点的时候
		this.setData({
			textAreaFocus: false,
			comment: e.detail.value
		})
	},
	backHandler() { // 返回上一页
		wx.navigateBack({
			delta: 1
		})
	},
	commentSubmit(e) {
		if (app.globalData.userInfo) {
			this.setData({
				userInfo: app.globalData.userInfo,
			});
			this.commentPost()
		} else {
			wx.getUserInfo({
				success: res => {
					console.log("用户数据获取成功：", res);
					app.globalData.userInfo = res.userInfo;
					this.setData({
						userInfo: res.userInfo,
					});
					this.commentPost()
				},
				fail: err => {
					console.log(err);
				}
			})
		}
	},
	commentPost() {
		let commentData = {
			com_content: this.data.comment,
			com_time: new Date().getTime(),
			content_id: this.data.content._id,
			guest_avatar: this.data.userInfo.avatarUrl,
			guest_id: this.data.userInfo.nickName
		};
		wx.cloud.callFunction({
			name: "addHandler",
			data: {
				collection: "comment",
				comment: commentData
			}
		}).then(res => {
			console.log(res);
			if (res.result.errMsg == "collection.add:ok") {
				const eventChannel = this.getOpenerEventChannel();
				eventChannel.emit("updateContentList");
				let tempCurComment = util.deepClone(this.data.content);
				console.log(tempCurComment);
				tempCurComment["comment"].unshift(commentData);
				console.log(tempCurComment);
				this.setData({
					comment: "",
					content: tempCurComment,
				});
			}
		}).catch(err => {
			console.log(err);
		})
	},
	onLoad: function (option) {
		const that = this;
		const eventChannel = this.getOpenerEventChannel();
		// 接收文章数据
		eventChannel.on('acceptDataFromOpenerPage', data => {
			let contentData = data.data;
			contentData.viewnum += 1; // 阅读数+1
			// wxparse解析文章内容, 文档: https://github.com/icindy/wxParse
			WxParse.wxParse('article', 'html', contentData.composition, that, 5);
			wx.cloud.callFunction({
				name: "updateHandler",
				data: {
					collection: "view_num",
					_id: contentData._id,
					viewnum: contentData.viewnum
				}
			}).then(res => {
				this.setData({
					content: contentData
				})
				eventChannel.emit("updateContentList", contentData)
			}).catch(err => {
				console.log(err);
			})
		})
	},
})