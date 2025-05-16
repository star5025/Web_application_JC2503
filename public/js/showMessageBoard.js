    // API地址（和后端端口一致）
    const API_BASE = 'http://localhost:5500';

    // 加载所有留言并渲染
    function loadMessages() {
      fetch(API_BASE + '/messages')
        .then(res => res.json())
        .then(msgs => {
          const msgDiv = document.getElementById('messages');
          msgDiv.innerHTML = msgs.map(m => `<p><b>${m.user}</b>: ${m.text}</p>`).join('');
        });
    }

    // 监听表单提交
    document.getElementById('msgForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const user = document.getElementById('user').value.trim();
      const text = document.getElementById('text').value.trim();
      if (!user || !text) return;
      fetch(API_BASE + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, text })
      }).then(res => res.json())
        .then(result => {
          if (result.success) {
            loadMessages();
            document.getElementById('text').value = '';
          } else {
            alert('提交失败: ' + (result.msg || '未知错误'));
          }
        });
    });

    // 页面加载时自动拉取留言
    loadMessages();