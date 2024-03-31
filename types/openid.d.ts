import 'openid';

declare module 'openid' {
	export type SimpleRegistrationOptions = {
		policy_url?: string,
		fullname?: boolean | 'required',
		nickname?: boolean | 'required',
		email?: boolean | 'required',
		dob?: boolean | 'required',
		gender?: boolean | 'required',
		postcode?: boolean | 'required',
		country?: boolean | 'required',
		timezone?: boolean | 'required',
		language?: boolean | 'required',
	};

	abstract class Extension {
		requestParams: Record<string, string>;
	}

	export class SimpleRegistration extends Extension {
		constructor(options: SimpleRegistrationOptions);
	}

	export class AttributeExchange extends Extension {
		constructor(options: Record<string, boolean | 'required'>);
	}
/*
	export type UserInterfaceOptions = {
		lang?: string,
		mode?: 'popup' | 'iframe',
		icon?: boolean,
	};
	export class UserInterface {
		constructor(options?: UserInterfaceOptions);
	}

	export class PAPE {
		constructor(options?: Record<string, string>);
	}
*/
}