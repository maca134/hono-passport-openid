import { promisify } from 'util';
import type { Context } from 'hono';
import openid from 'openid';
import { PassportError, type Awaitable, type HonoPassportStrategy } from '@maca134/hono-passport';

const { RelyingParty } = openid;

export type OpenIDStrategyOptions = {
	providerURL?: string,
	returnURL: string,
	realm: string,
	stateless?: boolean,
	strict?: boolean,
	identifierField?: string,
};

async function getIdentifier(ctx: Context, identifierField: string, options: OpenIDStrategyOptions) {
	let identifier = ctx.req.query(identifierField);

	if (!identifier && ctx.req.method === 'POST') {
		const contentType = ctx.req.header('Content-Type');
		switch (contentType) {
			case 'application/x-www-form-urlencoded':
			case 'multipart/form-data':
				const body = await ctx.req.parseBody();
				if (body && body[identifierField] && typeof body[identifierField] === 'string') {
					identifier = body[identifierField] as string;
				}
				break;
			case 'application/json':
				const json = await ctx.req.json();
				if (json && json[identifierField] && typeof json[identifierField] === 'string') {
					identifier = json[identifierField] as string;
				}
				break;
			default:
				break;
		}
	}

	if (!identifier && options.providerURL) {
		identifier = options.providerURL;
	}

	if (!identifier) {
		throw new PassportError('No identifier found');
	}
	return identifier;
}

function isOpenIDError(e: unknown): e is { message: string } {
	return typeof e === 'object' && e !== null && 'message' in e;
}

export function openidStrategy<TUser>(
	options: OpenIDStrategyOptions,
	validate: (
		ctx: Context,
		identifier: string,
	) => Awaitable<TUser | undefined>,
): HonoPassportStrategy<TUser> {
	const extensions: { requestParams: Record<string, string> }[] = [];

	const relyingParty = new RelyingParty(
		options.returnURL,
		options.realm,
		(options.stateless === undefined) ? false : options.stateless,
		(options.strict === undefined) ? true : options.strict,
		extensions
	);

	const authenticate = promisify(relyingParty.authenticate.bind(relyingParty));
	const verifyAssertion = promisify(relyingParty.verifyAssertion.bind(relyingParty));

	const identifierField = options.identifierField || 'openid_identifier';

	return {
		name: 'openid',
		authenticate: async (ctx, complete) => {
			if (!ctx.req.query('openid.mode')) {
				const identifier = await getIdentifier(ctx, identifierField, options);
				const url = await authenticate(identifier, false);
				if (!url) {
					throw new PassportError('Failed to generate authentication URL');
				}
				return ctx.redirect(url);
			}

			let result: Awaited<ReturnType<typeof verifyAssertion>>;
			try {
				result = await verifyAssertion(ctx.req.raw.url);
			} catch (e) {
				if (isOpenIDError(e)) {
					throw new PassportError(`Verify assertion failed: ${e.message}`)
				}
				throw e;
			}

			if (!result) {
				throw new PassportError('Invalid assertion');
			}

			if (!result.authenticated) {
				throw new PassportError('Failed to authenticate');
			}

			if (!result.claimedIdentifier) {
				throw new PassportError('No claimed identifier');
			}

			const user = await validate(ctx, result.claimedIdentifier);
			if (user) {
				await complete(user);
			}
		},
	};
}

