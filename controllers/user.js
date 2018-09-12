//Diclaration
const express = require('express');
const multer = require('multer');
const ejs = require('ejs');
const path = require('path');
const paypal = require('paypal-rest-sdk');

var router=express.Router();
var asyncValidator=require('async-validator');
var userModel=require.main.require('./models/user-model');
var dashboardModel=require.main.require('./models/admindashboard-model');
var index=require.main.require('./models/index');
productValidation=require.main.require('./Validation_rule/product_validation');
registrationValidation=require.main.require('./Validation_rule/registration_validation');
var date = require('date-and-time');

// Request Handler
//Exports
// Set The Storage Engine
const storage = multer.diskStorage({
	destination: './public/uploads/',
	filename: function(req, file, cb){
		cb(null,file.fieldname + '-' + Date.now() + path.extname(file.originalname));
	}
});

// Init Upload
const upload = multer({
	storage: storage,
	limits:{fileSize: 1000000},
	fileFilter: function(req, file, cb){
		checkFileType(file, cb);
	}
}).any();

// Check File Type
function checkFileType(file, cb){
// Allowed ext
const filetypes = /jpeg|jpg|png|gif/;
// Check ext
const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
// Check mime
const mimetype = filetypes.test(file.mimetype);

if(mimetype && extname){
	return cb(null,true);
} else {
	cb('Error: Images Only!');
}
}

// Init app
const app = express();

// EJS
app.set('view engine', 'ejs');

// Public Folder
app.use(express.static('./public'));


//paypal
paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': 'AaqBL3e8mMuoUA-igjbucH2KMhpMCBSwYaCYPzQPWnjk5I43BqcnIBRe49TEucQ59WD7Yz2HAAVFs0I5',
  'client_secret': 'EIdS4AtvBBd3Z1VNOZMRtuFrFBYVz8nQL5WYxaUiWNZSyej_30fLVcG0XpjQqv62a-_TIl9_pl1mMX3o'
});


router.post('/pay', function(req, res){
	const create_payment_json = {
		"intent": "sale",
		"payer": {
			"payment_method": "paypal"
		},
		"redirect_urls": {
			"return_url": "http://localhost:1234/user/success/"+req.body.promotion+"/"+req.body.productID,
			"cancel_url": "http://localhost:1234/user/cancel"
		},
		"transactions": [{
			"item_list": {
				"items": [{
					"name": "MissingBase: Post",
					"sku": "001",
					"price": req.body.promotion,
					"currency": "USD",
					"quantity": 1
				}]
			},
			"amount": {
				"currency": "USD",
				"total": req.body.promotion,
			},
			"description": "MissingBase Post"
		}]
	};

	paypal.payment.create(create_payment_json, function (error, payment) {
		if (error) {
			console.log(error.response);
			throw error;
		} else {
			for(let i = 0;i < payment.links.length;i++){
				if(payment.links[i].rel === 'approval_url'){
					res.redirect(payment.links[i].href);
				}
			}
		}
	});

});

router.get('/cancel',function(req, res){
	res.send('cancelled');
})


router.get('/success/:cost?/:id?', function(req, res) {
	const payerId = req.query.PayerID;
	const paymentId = req.query.paymentId;

	const execute_payment_json = {
		"payer_id": payerId,
		"transactions": [{
			"amount": {
				"currency": "USD",
				"total": req.params.cost,

			}
		}]
	};

	paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
		if (error) {
			console.log(error.response);
			throw error;
		} else {
			console.log(JSON.stringify(payment));
			var promobdt = req.params.cost;
				promobdt = promobdt*80;
			var data={
				promotion: promobdt,
				id: req.params.id,
			};
			userModel.promoupdate(data,function(valid){
				if(valid)
				{
					res.redirect('/user/productlist');
				}
				else
				{
					res.render('/error/error');
				}
			});


		}
	});
});



router.get('/useredit/:username?',function(req,res){
	var data={
		username: req.params.username,
	};
	userModel.useredit(data,function(result){
		res.render('./user/editprofile',{result:result});
	});
});
router.post('/useredit/:username?',function(req,res){
	var data={
		username: req.params.username,
		name: req.body.name,
		email: req.body.email,
		phone: req.body.phone,
		address: req.body.address
	};
	userModel.userprofileupdate(data,function(valid){
		if(valid)
		{
			res.redirect('/user/user');
		}
		else
		{
			res.redirect('/error');
		}
	});
});
router.get('/broughthistory/:id?',function(req,res){
	var data={
		id: req.params.id,
	};
	userModel.broughthistory(data,function(result){
		if(result)
		{
			res.render('./user/broughthistory',{result:result});
		}
		else
		{
			res.render('/error/error');
		}
	});
});


router.get('/addproduct',function(req,res){

	var uname= req.session.loggedUser;

	if (uname == "Guest") {
		res.redirect('/login');
	}
	else{
		var data={
			username: req.params.username,
		};

		userModel.user(data,function(result){
			res.render('./user/addproduct',{result: result,uname});
		});


	}
});




router.post('/upload', function(req, res) {

	upload(req, res, (err) => {
		var uname = req.session.loggedUser;
		if(err){
			res.render('./user/addproduct', {
				msg: err,uname,
			});
		}

		else {
			if(req.files[0] == undefined && req.files[1] == undefined && req.files[2] == undefined ){
				res.render('./user/addproduct', {
					msg: 'Error: No File Selected!',
					uname,
				});
			} else {
				var uname = req.session.loggedUser;

				var file1,file2=null,file3=null;
				// file1 = `/uploads/${req.files[0].filename}`;
				// file2 = `/uploads/${req.files[1].filename}`;
				// file3 = `/uploads/${req.files[2].filename}`;

				if(req.files[0]!=undefined){	
					file1 = `/uploads/${req.files[0].filename}`;
				}
				else{
					file1="https://i.imgur.com/S58Jnn6.jpg";
				}
				if(req.files[1]!=undefined){	
					file2 = `/uploads/${req.files[1].filename}`;
				}

				if(req.files[2]!=undefined){	
					file3 = `/uploads/${req.files[2].filename}`;
				}

				res.render('./user/addproduct',{
					uname,file1,file2,file3,

				});
			}
		}

	});

});


router.post('/edit/:id?', function(req, res) {

	upload(req, res, (err) => {
		var uname = req.session.loggedUser;

		var data={
			id: req.params.id
		};

		userModel.productedit(data,function(result){

			if(err){
				res.render('./user/editproduct', {
					msg: err,uname,result:result,
				});
			}

			else {


				if(req.files[0] == undefined && req.files[1] == undefined && req.files[2] == undefined ){
				res.render('./user/editproduct', {
					msg: 'Error: No File Selected!',
					uname,
					result:result,
				});
			} else {
				var uname = req.session.loggedUser;

				var file1,file2=null,file3=null;
				// file1 = `/uploads/${req.files[0].filename}`;
				// file2 = `/uploads/${req.files[1].filename}`;
				// file3 = `/uploads/${req.files[2].filename}`;

				if(req.files[0]!=undefined){	
					file1 = `/uploads/${req.files[0].filename}`;
				}
				else{
					file1="https://i.imgur.com/S58Jnn6.jpg";
				}
				if(req.files[1]!=undefined){	
					file2 = `/uploads/${req.files[1].filename}`;
				}

				if(req.files[2]!=undefined){	
					file3 = `/uploads/${req.files[2].filename}`;
				}

				res.render('./user/editproduct',{
					uname,file1,file2,file3,result:result,

				});
			}

			}
		});

	});

});




router.post('/addproduct',function(req,res){

	var uname = req.session.loggedUser;
	if(uname == "Guest")
	{
		res.redirect('/login');
	}

	var test =   req.body.test;
	var prevpage=0,nextpage=1;
	var image=req.body.quantity;

	if(image.length < 1){
		image = "https://i.imgur.com/S58Jnn6.jpg";	
	}
	

	var data={
		productname: req.body.productname,
		price: req.body.price,
		quantity: image,
		logged_user: req.session.loggedUser,
		catagory: req.body.catagory,
		origin: req.body.origin,
		category: req.body.category,
		agent_name: req.body.agent_name,
		details: req.body.details,
		date: date.format(new Date(), 'YYYY/MM/DD'),
		promotion: req.body.promotion,
	};

		res.render('./promotion/promotion',{data,uname});


});

router.all('/createpost',function(req,res){

	var uname = req.session.loggedUser;
	var image1=req.body.Image1;
	var image2=req.body.Image2;
	var image3=req.body.Image3;
	
			if(image1.length <1){
				image1 ="https://i.imgur.com/S58Jnn6.jpg";
			}
			if(image2.length <1){
				image2 =null;
			}
			if(image3.length <1){
				image3 =null;
			}

	var data={
		productname: req.body.productname,
		price: req.body.price,
		img1: image1,
		img2: image2,
		img3: image3,
		
		logged_user: req.session.loggedUser,
		catagory: req.body.catagory,
		origin: req.body.origin,
		category: req.body.category,
		agent_name: req.body.agent_name,
		details: req.body.details,
		date: date.format(new Date(), 'YYYY/MM/DD'),
		promotion: req.body.promotion,
	};

	userModel.productInsert(data,function(valid){
		if(valid)
		{
			var uname = req.session.loggedUser;
			var image1=req.body.Image1;
			var image2=req.body.Image2;
			var image3=req.body.Image3;
			
			if(image1.length <1){
				image1 ="https://i.imgur.com/S58Jnn6.jpg"
			}
			if(image2.length <1){
				image2 ="https://i.imgur.com/S58Jnn6.jpg"
			}
			if(image3.length <1){
				image3 ="https://i.imgur.com/S58Jnn6.jpg"
			}


			var data={
				productname: req.body.productname,
				price: req.body.price,
				quantity: image1,
				img2: image2,
				img3: image3,
				username: req.session.loggedUser,
				catagory: req.body.catagory,
				origin: req.body.origin,
				category: req.body.category,
				agent_name: req.body.agent_name,
				details: req.body.details,
				date: date.format(new Date(), 'YYYY/MM/DD'),
				promotion: req.body.promotion,
			};

					userModel.productlist(data,function(result){
						if(result!=null){
							res.render('./promotion/promotion',{result:result,data,uname});
						}
						else{
							res.redirect('/error/error');
						}

					});
			
		}
		else
		{
			res.redirect('/index');
		}
	});

});



router.all('/productlist',function(req,res){

	var data={
		username: req.session.loggedUser
	}

	var uname = req.session.loggedUser;
	if (uname =="Guest") {
		res.redirect('/login');
	}

	else{
		userModel.productlist(data,function(result){
			if(result!=null)
			{
				res.render('./user/productlist',{result: result,uname});
			}
			else
			{
				res.render('./error/error');
			}
		});
	}
});

router.get('/productedit/:id?',function(req,res){
	var data={
		id: req.params.id
	};
	var uname = req.session.loggedUser;
	userModel.productedit(data,function(result){
		res.render('./user/editproduct',{result:result,uname});
	});
});
router.post('/productedit/:id?',function(req,res){
	var data={
		id: req.params.id,
		productname: req.body.productname,
		price: req.body.price,
		quantity: req.body.quantity,
		catagory: req.body.catagory,
		origin: req.body.origin,
		category: req.body.category,
		agent_name: req.body.agent_name,
		details: req.body.details,
		date: date.format(new Date(), 'YYYY/MM/DD'),
		promotion: req.body.promotion,
	};

	userModel.productupdate(data,function(valid){
		if(valid)
		{
			// res.redirect('/user/productlist',{file: `uploads/${req.file.filename}`});
			res.redirect('/user/productlist');
		}
		else
		{
			res.render('/error/error');
		}
	});





});

router.all('/user',function(req,res){
	var data={
		username: req.session.loggedUser
	}
	userModel.user(data,function(result){
		if(result)
		{
			res.render('./user/userprofile',{result: result});
		}
		else
		{
			res.redirect('/error');
		}
	});
});


router.post('/promotion/:id?',function(req,res){
	var uname=req.session.loggedUser;
	var postID = req.params.id;
	res.render('promotion/update',{uname,postID});
});

module.exports=router;

