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
		danmuList: null, // 弹幕内容
		videoDuration: null, // 视频长度
		isFromSharePage: false, // 是否是从分享页面进来的
		isOverShare: true
	},
	onShareAppMessage(res) { // 分享设置
		// console.log(res);
		// if (res.from === 'button') {
		// 	// 来自页面内转发按钮
		// }
		return {
			title: this.data.content.title,
			path: '/pages/public/content/content?contentID=' + this.data.content._id,
			imageUrl: this.data.content.poster || ""
		}
	},
	commentHandler(e) { // 点击评论的时候-跳转至输入框
		this.setData({
			textAreaFocus: true
		});
		wx.pageScrollTo({
			duration: 300,
			selector: "#comment_submit_btn"
		})
	},
	inputHandler(e) { // 评论框输入监听
		this.setData({
			comment: e.detail.value
		})
	},
	blurHandler(e) { // 失去焦点的时候
		this.setData({
			textAreaFocus: false
		})
	},
	likeHandler() { // 收藏按钮点击事件
		wx.showToast({
			title: '哎呀还没写- -',
		})
	},
	backHandler() { // 返回上一页
		wx.navigateBack({
			delta: 1
		})
	},
	commentSubmit(e) {
		if (this.data.comment.trim() == "" || this.data.comment.length > 140) { // 过滤无效评论内容
			wx.showToast({
				title: '请检查评论内容',
				icon: 'error',
				mask: true,
				duration: 1000
			});
		} else {
			wx.showLoading({
				title: 'loading',
			});
			/* *******拦截评论内容,进行审核验证******* */
			wx.cloud.callFunction({
					name: "addHandler",
					data: {
						collection: "checkContent",
						content: this.data.comment.trim()
					},
				})
				.then(res => {
					console.log("接口调用结果: ", res);
					if (res.result.errCode == 87014) { // 1- 评论有敏感内容
						wx.hideLoading();
						return wx.showToast({
							title: '评论不能太敏感噢',
							duration: 1000
						})
					} else { // 2- 评论正常,可提交
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
					}
				})
		}
	},
	commentPost() { // 评论提交
		let commentData = {
			com_content: this.data.comment.trim(),
			com_time: new Date().getTime(),
			content_id: this.data.content._id,
			guest_avatar: this.data.userInfo.avatarUrl,
			guest_id: this.data.userInfo.nickName,
			openid: app.globalData.openid,
			auth_is_read: 0, // 作者是否已阅
			auth_response: []
		};
		wx.cloud.callFunction({
			name: "addHandler",
			data: {
				collection: "comment",
				comment: commentData
			}
		}).then(res => {
			if (res.result.errMsg == "collection.add:ok") {
				const eventChannel = this.getOpenerEventChannel();
				if (JSON.stringify(eventChannel) != "{}") eventChannel.emit("updateContentList");
				let tempCurComment = util.clone(this.data.content, 'obj');
				tempCurComment["comment"].unshift(commentData);
				this.setData({
					comment: "",
					content: tempCurComment,
				});
			}
		}).catch(err => {
			console.log(err);
		}).finally(_ => {
			wx.hideLoading()
		})
	},
	onLoad: function (option) {
		wx.showLoading({
			title: "loading...",
			mask: true
		});
		const that = this;
		if (option.contentID) { // 如果是分享页进入
			wx.cloud.callFunction({
				name: "getHandler",
				data: {
					collection: "singleContent",
					contentID: option.contentID
				}
			}).then(res => {
				if (res.result) {
					let CONTENT = res.result.list[0];
					CONTENT.viewnum += 1;
					WxParse.wxParse('article', 'html', res.result.list[0].composition, that, 5);
					this.setData({
						content: CONTENT,
						isFromSharePage: true
					})
				} else {}
				wx.hideLoading()
			}).catch(err => {
				console.log(err);
				wx.hideLoading()
			})
		} else { // 如果是列表页点击进入
			const eventChannel = this.getOpenerEventChannel();
			// 接收文章数据
			eventChannel.on('acceptDataFromOpenerPage', data => {
				let contentData = data.data;
				contentData.viewnum += 1; // 阅读数+1
				// wxparse解析文章内容, 文档: https://github.com/icindy/wxParse
				WxParse.wxParse('article', 'html', contentData.composition, that, 5);
				this.setData({
					content: contentData,
					isFromSharePage: false
				})
				wx.cloud.callFunction({
					name: "updateHandler",
					data: {
						collection: "view_num",
						_id: contentData._id,
						viewnum: contentData.viewnum
					}
				}).then(res => {
					eventChannel.emit("updateContentList", contentData)
				}).catch(err => {
					console.log(err);
				}).finally(_ => {
					wx.hideLoading()
				})
			})
		}
	},
	onReady() {
		this.videoContext = wx.createVideoContext('myVideo')
	},
	getVideoInfo(e) {
		this.setData({
			videoDuration: e.detail.duration
		});
		let duration = e.detail.duration;
		let partA = this.data.content.comment.map(v => {
			return {
				text: v.com_content,
				time: parseInt(Math.random() * (duration / 2))
			}
		})
		let partB = this.data.content.comment.map(v => {
			return {
				text: v.com_content,
				time: parseInt(Math.random() * (duration - duration / 2) + duration / 2)
			}
		})
		console.log(partA.concat(partB));
		this.setData({
			danmuList: partA.concat(partB)
		})
	},
	onUnload: function (option) {
		// 页面销毁时执行
		console.log("页面销毁,当前viewnum: ", this.data.content.viewnum);
		if (this.data.isFromSharePage) {
			wx.cloud.callFunction({
					name: "updateHandler",
					data: {
						collection: "view_num",
						_id: this.data.content._id,
						viewnum: this.data.content.viewnum
					}
				})
				.then(res => {
					console.log(res)
				})
				.catch(err => {
					console.log(err)
				})
		}
	},
})