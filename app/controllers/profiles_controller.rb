class ProfilesController < ApplicationController
  before_action :authenticate_user!

  def show
    respond_to do |format|
      format.json do
        u = current_user

        avatar_url = u.avatar.attached? ? url_for(u.avatar) : nil
        avatar_thumb_url = nil
        if u.avatar.attached?
          begin
            avatar_thumb_url = url_for(u.avatar.variant(resize_to_fill: [96, 96]))
          rescue => e
            Rails.logger.warn("[profile] variant failed: #{e.class}: #{e.message}")
            avatar_thumb_url = avatar_url
          end
        end

        render json: {
          username:      u.username,
          display_name:  u.full_name.presence || u.username,
          company:       u.company.to_s,
          department:    u.department.to_s,
          work_location: u.work_location.to_s,
          bio:           u.bio.to_s,
          avatar_url:    avatar_url,
          avatar_thumb_url: avatar_thumb_url
        }
      end
      format.html { redirect_to edit_profile_path }
    end
  end

  def new
    redirect_to root_path and return if current_user.profile_completed?
    @user = current_user
  end

  def create
    @user = current_user
    if @user.update(profile_params_html.merge(profile_completed: true))
      redirect_to root_path, notice: "アカウント情報を登録しました。"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @user = current_user
  end

  def update
    @user = current_user
    respond_to do |format|
      format.html do
        if @user.update(profile_params_html)
          redirect_to root_path, notice: "更新しました。"
        else
          render :edit, status: :unprocessable_entity
        end
      end

      format.json do
        if @user.update(profile_params_json)
          render json: { ok: true }
        else
          render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end
  end

  private
  def profile_params_html
    params.require(:user).permit(:username, :full_name, :company, :work_location, :department, :bio, :avatar)
  end

  def profile_params_json
    p = params.require(:profile).permit(:username, :display_name, :full_name, :company, :work_location, :department, :bio, :avatar)
    p[:full_name] ||= p.delete(:display_name) if p.key?(:display_name)
    p
  end
end
