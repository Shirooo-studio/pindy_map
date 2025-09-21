module ApplicationHelper
  # 右サイドバー用のアクティブクラス
  def nav_active_class(path)
    active =
    if path == '/me'
      request.path == '/me'
    else
      current_page?(path)
    end
  active ? 'is-active' : ''
  end
end
