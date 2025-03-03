wiki.get('/member/signup', (a, b) => b.redirect('/member/signup_privacy'));

wiki.get('/member/signup_privacy', async function signupEmailScreen(req, res) {
	var desturl = req.query['redirect'];
	if(!desturl) desturl = '/';
	
	if(islogin(req)) { res.redirect(desturl); return; }
	
	const captcha = generateCaptcha(req, 1);
	
	await curs.execute("select username from users");
	const maxusercount = atoi(config.getString('max_users', '-1'));
	
	if(maxusercount != -1 && curs.fetchall().length >= maxusercount) {
		res.send(await showError(req, 'user_count_reached_maximum'));
		return;
	}
	
	res.send(await render(req, '사용 약관을 읽어주십시오.', `
		<form class=signup-form>
			<div class=form-group>
				<label>개인정보처리방침:</label><br />
				<textarea class=form-control readonly rows=15>${config.getString('privacy', '')}</textarea>
			</div>
		
			<div class=btns>
				<a href="/member/signup_email" class="btn btn-secondary">동의함</a>
				<a href=/ id=declinePrivacyBtn class="btn btn-primary">동의 안 함</a>
			</div>
		</form>
	`, {}));
});

wiki.get('/member/signup_email', async function signupEmailScreen(req, res) {
	var desturl = req.query['redirect'];
	if(!desturl) desturl = '/';
	
	if(islogin(req)) { res.redirect(desturl); return; }
	
	const captcha = generateCaptcha(req, 1);
	
	await curs.execute("select username from users");
	const maxusercount = atoi(config.getString('max_users', '-1'));
	
	if(maxusercount != -1 && curs.fetchall().length >= maxusercount) {
		res.send(await showError(req, 'user_count_reached_maximum'));
		return;
	}
	
	if(config.getString('disable_email', '1') == '1') {
		return res.redirect('/member/signup_key?key=pass');
	}
	
	res.send(await render(req, '계정 만들기', `
		<form method=post class=signup-form>
			<div class=form-group>
				<label>전자 우편:</label><br>
				<input type=email name=email class=form-control>
			</div>
				
			<div class=form-group>
				${captcha}
			</div>
		
			<div class=btns>
				<button type=reset class="btn btn-secondary">초기화</button>
				<button type=submit class="btn btn-primary">가입</button>
			</div>
		</form>
	`, {}));
});

async function emailConfirmation(req, res) {
	await curs.execute("select username from users");
	const maxusercount = atoi(config.getString('max_users', '-1'));
	
	if(maxusercount != -1 && curs.fetchall().length >= maxusercount) {
		res.send(await showError(req, 'user_count_reached_maximum'));
		return;
	}
	
	var desturl = req.query['redirect'];
	if(!desturl) desturl = '/';
	
	if(islogin(req)) { res.redirect(desturl); return; }
	
	if(!validateCaptcha(req)){ res.send(await showError(req, 'invalid_captcha_number'));return; }
	
	const captcha = generateCaptcha(req, 1);
	
	await curs.execute("delete from account_creation where cast(time as integer) < ?", [Number(getTime()) - 86400000]);
	
	await curs.execute("select email from account_creation where email = ?", [req.body['email']]);
	if(curs.fetchall().length) {
		return res.send(await showError(req, 'email_taken'));
	}
	
	const key = rndval('abcdef1234567890', 64);
	
	curs.execute("insert into account_creation (key, email, time) values (?, ?, ?)", [key, req.body['email'], String(getTime())]);
	
	try {
		await curs.execute("select email_service, email_addr, email_pass from email_config");
		
		const edata = curs.fetchall()[0];
		
		nodemailer.createTransport({
			service: edata['email_service'],
			auth: {
				user: edata['email_addr'],
				pass: edata['email_pass']
			}
		}).sendMail({
			from: edata['email_addr'],
			to: req.body['email'],
			subject: config.getString('site_name', '위키') + ' 가입 인증',
			html: config.getString('registeration_verification', key).replace(/[$]WIKINAME/gi, config.getString('site_name', '위키')).replace(/[$]ADDRESS/gi, key)
		}, (e, s) => {
			if(e) {
				print(`[오류!] ${e}`);
				beep(3);
			}
		});
	} catch(e) {}
	
	res.send(await render(req, '계정 만들기', `
		<p>
			입력한 주소로 인증 우편을 전송했습니다. 우편에 적혀있는 키를 다음 상자에 입력하십시오. 우편이 안보일 경우 스팸함을 확인하십시오.
		</p>
		
		<form method=get action=/member/signup_key>
			<input type=text id=keyInput name=key class=form-control>
			
			<div class=btns>
				<button type=submit class="btn btn-info" style="width: 100px;">확인</button>
			</div>
		</form>
		
		<p style="font-weight: bold; color: red;">
			[디버그] 가입 키: ${key}
		</p>
	`, {}));
}

wiki.post('/member/signup_email', emailConfirmation);
wiki.post('/member/signup', emailConfirmation);