/** One short-lived rendezvous per receiving browser; storage contains ciphertext only. */
export class AuthBridgeSession {
  constructor(ctx) {
    this.ctx = ctx
  }

  async fetch(request) {
    const action = new URL(request.url).pathname.slice(1)
    const input = await request.json()
    return this.ctx.storage.transaction(async (storage) => {
      const session = await storage.get('session')
      if (action === 'create') {
        if (session) return Response.json({ message: '配对已存在' }, { status: 409 })
        await storage.put('session', { ...input, state: 'waiting' })
        await storage.setAlarm(input.expiresAt)
        return Response.json({ success: true })
      }
      if (!session || session.expiresAt <= Date.now()) {
        await storage.delete('session')
        return Response.json({ message: '授权已过期，请重新开始' }, { status: 410 })
      }
      const authorized =
        action === 'receive'
          ? input.uploadHash === session.uploadHash
          : input.receiverHash === session.receiverHash
      if (!authorized) return Response.json({ message: '配对身份不匹配' }, { status: 403 })
      if (action === 'cancel') {
        await storage.delete('session')
        return Response.json({ success: true })
      }
      if (action === 'receive') {
        if (session.state !== 'waiting')
          return Response.json({ message: '本次授权已经提交' }, { status: 409 })
        session.envelope = input.envelope
        session.state = 'ready'
        await storage.put('session', session)
      } else if (action === 'claim') {
        if (!['ready', 'claimed'].includes(session.state))
          return Response.json({ message: '尚未收到登录凭据' }, { status: 409 })
        // Retain ciphertext until acknowledgement/cancellation or expiry so a lost
        // Set-Cookie response can be retried by this receiver only.
        session.state = 'claimed'
        await storage.put('session', session)
        return Response.json({ envelope: session.envelope, privateKey: session.privateKey })
      } else if (action !== 'status') {
        return Response.json({ message: '未知配对操作' }, { status: 404 })
      }
      return Response.json({ success: true, state: session.state, expiresAt: session.expiresAt })
    })
  }

  async alarm() {
    await this.ctx.storage.deleteAll()
  }
}
