import { env } from '../config.js';
import { getDb } from '../db.js';

export async function sendEmail(customerId:string|null,orderId:string|null,to:string,subject:string,html:string,template:string){
  if(!env.RESEND_API_KEY){return false;}
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,html})});
    const text=await response.text();
    const pool=await getDb();
    await pool.request().input('customerId',customerId).input('orderId',orderId).input('channel','EMAIL').input('template',template).input('recipient',to).input('status',response.ok?'SENT':'FAILED').input('error',response.ok?null:text.slice(0,1000)).query(`INSERT INTO notification_log(customer_id,order_id,channel,template,recipient,status,error_message) VALUES(@customerId,@orderId,@channel,@template,@recipient,@status,@error)`);
    return response.ok;
  }catch(error){try{const pool=await getDb();await pool.request().input('customerId',customerId).input('orderId',orderId).input('channel','EMAIL').input('template',template).input('recipient',to).input('status','FAILED').input('error',error instanceof Error?error.message:'Email failed').query(`INSERT INTO notification_log(customer_id,order_id,channel,template,recipient,status,error_message) VALUES(@customerId,@orderId,@channel,@template,@recipient,@status,@error)`)}catch{}return false;}
}

export async function sendOrderStatusEmail(orderId:string,status:string){
  const pool=await getDb();const row=(await pool.request().input('id',orderId).query<any>(`SELECT TOP 1 o.order_number orderNumber,o.customer_id customerId,c.email,o.tracking_number trackingNumber,o.carrier,o.tracking_url trackingUrl FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=@id`)).recordset[0];
  if(!row?.email)return false;
  const subject=`SmolStudio order ${row.orderNumber}: ${status}`;
  const tracking=row.trackingUrl?`<p><a href="${row.trackingUrl}">Track your shipment</a></p>`:'';
  return sendEmail(row.customerId,orderId,row.email,subject,`<p>Your SmolStudio order <strong>${row.orderNumber}</strong> is now <strong>${status}</strong>.</p>${tracking}<p>Thank you for shopping with SmolStudio.</p>`,`ORDER_${status}`);
}
