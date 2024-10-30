let adminClients =[]; 
exports.sseAdmin=(req, res)=>{
    res.setHeader('Content-Type', 'text/event-stream' ); 
    res.setHeader('Cache-Control', 'no-cache'); 
    res.setHeader('Connection', 'keep-alive'); 
    res.flushHeaders(); 
    adminClients.push(res); 
    req.on('close', ()=>{
        adminClients = adminClients.filter(client => client !== res); 

    })
}; 
exports.sendAdminUpdate =(data)=>{
    adminClients.forEach(client=>{
        client.write(`data:${JSON.stringify(data)}\n\n`);  // Send data to client
    })
}