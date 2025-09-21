class ApplicationController < ActionController::Base
  before_action :configure_permitted_parameters, if: :devise_controller?
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  protected

  def configure_permitted_parameters
    keys = [ :username, :full_name, :company, :work_location, :department ]
    devise_parameter_sanitizer.permit(:sign_up, keys: keys)
    devise_parameter_sanitizer.permit(:account_update, keys: keys)
  end

  # ログイン後：未完ならプロフィール入力へ
  def after_sign_in_path_for(resource)
    resource.profile_completed? ? super : new_profile_path
  end

  def after_sign_out_path_for(resource_or_scope)
    new_user_session_path
  end
end
